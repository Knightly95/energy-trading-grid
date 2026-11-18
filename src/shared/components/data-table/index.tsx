import { useCallback, useMemo, useState } from 'react';
import {
  DataGrid,
  type GridCellParams,
  type GridColDef,
  type GridRowClassNameParams,
} from '@mui/x-data-grid';
import Paper from '@mui/material/Paper';
import IconButton from '@mui/material/IconButton';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import type { SxProps, Theme } from '@mui/material/styles';

import { useRowChangeDetection } from './hooks/useRowChangeDetection';
import { dataGridAnimationStyles } from './styles';
import { readBenchmarkOptions } from '@/shared/utils/benchmark';

export interface RowAction<T> {
  label: string;
  onClick: (row: T) => void;
  icon?: React.ReactNode;
  id?: string;
}

export type RowActionsGetter<T> = (row: T) => RowAction<T>[];

export interface DataTableProps<T extends { id: string | number }> {
  rows: T[];
  columns: GridColDef[];
  actions?: RowAction<T>[] | ((row: T) => RowAction<T>[]);
  checkboxSelection?: boolean;
  pageSizeOptions?: number[];
  sx?: SxProps<Theme>;
  /**
   * Height of the grid. Rows beyond it scroll inside the grid, which lets it
   * render only the visible rows.
   */
  height?: number | string;
}

export function DataTable<T extends { id: string | number }>({
  rows,
  columns,
  actions,
  checkboxSelection = false,
  pageSizeOptions = [10, 25, 50, 100],
  sx,
  height = 640,
}: DataTableProps<T>) {
  const bench = readBenchmarkOptions();
  const paginationModel = { page: 0, pageSize: bench.pageSize ?? pageSizeOptions[0] };
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [selectedRow, setSelectedRow] = useState<T | null>(null);
  const { newRows, changedCells } = useRowChangeDetection(rows);

  const handleMenuClose = () => {
    setAnchorEl(null);
    setSelectedRow(null);
  };

  const handleActionClick = (action: RowAction<T>) => {
    if (!selectedRow) return;
    action.onClick(selectedRow);
    handleMenuClose();
  };

  // Built once per set of columns and actions, so the grid does not
  // recompute its columns on every live update.
  const allColumns = useMemo(() => {
    if (!actions || (Array.isArray(actions) && actions.length === 0)) return columns;
    const actionsColumn: GridColDef = {
      field: 'actions',
      headerName: 'Actions',
      width: 80,
      sortable: false,
      filterable: false,
      renderCell: (params) => {
        const row = params.row as T;
        const rowActions = typeof actions === 'function' ? actions(row) : actions;
        if (rowActions.length === 0) return null;

        return (
          <IconButton
            onClick={(event) => {
              event.stopPropagation();
              setAnchorEl(event.currentTarget);
              setSelectedRow(row);
            }}
            size="small"
          >
            <MoreVertIcon />
          </IconButton>
        );
      },
    };
    return [actionsColumn, ...columns];
  }, [actions, columns]);

  const getRowClassName = useCallback(
    (params: GridRowClassNameParams) => (newRows.has(params.id) ? 'row-flash-new' : ''),
    [newRows],
  );
  const getCellClassName = useCallback(
    (params: GridCellParams) =>
      changedCells.get(params.id)?.has(params.field) ? 'cell-flash-changed' : '',
    [changedCells],
  );

  return (
    <>
      <Paper sx={{ width: '100%', height, ...sx }}>
        <DataGrid
          rows={rows}
          columns={allColumns}
          initialState={{ pagination: { paginationModel } }}
          pageSizeOptions={pageSizeOptions}
          disableVirtualization={!bench.virtualization}
          checkboxSelection={checkboxSelection}
          getRowClassName={getRowClassName}
          getCellClassName={getCellClassName}
          sx={dataGridAnimationStyles}
        />
      </Paper>
      {actions && selectedRow && (
        <Menu
          anchorEl={anchorEl}
          open={Boolean(anchorEl)}
          onClose={handleMenuClose}
          anchorOrigin={{
            vertical: 'bottom',
            horizontal: 'left',
          }}
        >
          {(typeof actions === 'function' ? actions(selectedRow) : actions).map((action) => (
            <MenuItem key={action.id || action.label} onClick={() => handleActionClick(action)}>
              {action.icon && <span style={{ marginRight: 8 }}>{action.icon}</span>}
              {action.label}
            </MenuItem>
          ))}
        </Menu>
      )}
    </>
  );
}
