"use client"

import { Component, type ErrorInfo, type ReactNode } from "react"
import { Button } from "@/components/ui/button"

type Props = {
  children: ReactNode
  onReset?: () => void
  fallbackTitle?: string
}

type State = { hasError: boolean }

export class ProductDetailErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.warn("Produkt-Detail: Rendering fehlgeschlagen.", error, info)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-6 text-center">
          <p className="font-medium text-red-600 dark:text-red-400">
            {this.props.fallbackTitle ??
              "Dieses Produkt konnte gerade nicht vollstaendig angezeigt werden."}
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
