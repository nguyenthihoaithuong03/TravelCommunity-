import type { Server } from "socket.io";

let io: Server | null = null;

export const setSocketIO = (
  socketServer: Server
): void => {
  io = socketServer;
};

export const getSocketIO = (): Server | null => {
  return io;
};