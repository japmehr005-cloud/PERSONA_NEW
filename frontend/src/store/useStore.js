import { create } from 'zustand'

export const useStore = create((set, get) => ({
  user: null,
  accessToken: null,
  setAuth: (user, token) => set({ user, accessToken: token }),
  logout: () => set({ user: null, accessToken: null, profile: null, gamification: null }),

  profile: null,
  setProfile: (profile) => set({ profile }),

  gamification: null,
  setGamification: (g) => set({ gamification: g }),
  addXP: (amount) =>
    set((state) => ({
      gamification: state.gamification
        ? { ...state.gamification, xp: state.gamification.xp + amount }
        : state.gamification,
    })),
  incrementSimCount: () =>
    set((state) => ({
      gamification: state.gamification
        ? { ...state.gamification, simCount: (state.gamification.simCount || 0) + 1 }
        : state.gamification
    })),

  xpToast: null,
  showXPToast: (title, subtitle, amount) => {
    set({ xpToast: { title, subtitle, amount } })
    setTimeout(() => set({ xpToast: null }), 3500)
  },

  pendingAction: null,
  setPendingAction: (action) => set({ pendingAction: action }),
  clearPendingAction: () => set({ pendingAction: null }),

  securityScore: 0,
  setSecurityScore: (score) => set({ securityScore: score }),
}))
