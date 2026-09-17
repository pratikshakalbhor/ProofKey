import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type Role = 'issuer' | 'holder' | 'verifier';

interface RoleState {
  role: Role;
  setRole: (role: Role) => void;
}

export const useRoleStore = create<RoleState>()(
  persist(
    (set) => ({
      role: 'holder',
      setRole: (role) => set({ role }),
    }),
    { name: 'vs-role' },
  ),
);