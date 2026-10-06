import { createContext, useContext } from 'react'

export const ToastContext = createContext(() => {})

/** Shows a short message at the bottom of the screen. Pass 'error' as the second argument for failures. */
export const useToast = () => useContext(ToastContext)
