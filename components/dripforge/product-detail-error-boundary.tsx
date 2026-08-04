"use client"

import { Component, type ErrorInfo, type ReactNode } from "react"
import { Button } from "@/components/ui/button"

type Props = {
  children: ReactNode
  onReset?: () => void
  /** Called when an error is caught (e.g. close lightbox). */
  onError?: () => void
  fallbackTitle?: string
  /** Custom fallback; when provided, replaces the default error UI. */
  fallback?: ReactNode
}

type State = { hasError: boolean }

export class ProductDetailErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.warn("Produkt-Detail: Rendering fehlgeschlagen.", error, info)
    this.props.onError?.()
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback !== undefined) {
        return this.props.fallback
      }
      return (
        <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-6 text-center">
          <p className="font-medium text-red-600 dark:text-red-400">
            {this.props.fallbackTitle ??
              "Dieses Produkt konnte gerade nicht vollständig angezeigt werden."}
          </p>
          <Button
            type="button"
            variant="outline"
            className="mt-4"
            onClick={() => {
              this.setState({ hasError: false })
              this.props.onReset?.()
            }}
          >
            Erneut versuchen
          </Button>
        </div>
      )
    }

    return this.props.children
  }
}
