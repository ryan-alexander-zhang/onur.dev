'use client'

import { createContext, useContext } from 'react'

const GithubProfileContext = createContext(null)

export function GithubProfileProvider({ profile, children }) {
  return <GithubProfileContext.Provider value={profile}>{children}</GithubProfileContext.Provider>
}

export function useGithubProfile() {
  return useContext(GithubProfileContext)
}
