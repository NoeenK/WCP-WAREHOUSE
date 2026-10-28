import type { RoomModule } from '../packages/room-runtime/types';
export const ROOMS: RoomModule[] = [{ id: 'warehouse', label: 'WCP Warehouse', build: async () => (await import('./warehouse')).warehouse.build() }];
export const roomById = (id: string | null) => ROOMS.find(r => r.id === id) ?? ROOMS[0];
export type { BuiltRoom, RoomModule } from '../packages/room-runtime/types';
