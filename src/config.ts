interface Config {
  /**
   * `mock` (default): REST and WebSocket traffic is simulated in the browser, so
   * the app runs with no servers. `live`: talk to the servers in `api/`.
   */
  backend: 'mock' | 'live';
  api: {
    baseUrl: string;
  };
  socket: {
    url: string;
  };
}

export const config: Config = {
  backend: import.meta.env.VITE_BACKEND === 'live' ? 'live' : 'mock',
  api: {
    baseUrl: import.meta.env.VITE_API_URL || 'http://localhost:3000',
  },
  socket: {
    url: import.meta.env.VITE_SOCKET_URL || 'http://localhost:4001',
  },
};
