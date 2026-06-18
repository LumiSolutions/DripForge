"use client"

import { useState } from "react"
import { Page3DDruck } from "@/components/dripforge/views/page-3d-druck"
import { useShopNavigate } from "@/hooks/use-shop-navigate"

export default function Druck3DInfoPage() {
  const navigate = useShopNavigate()
  const [selectedMaterial, setSelectedMaterial] = useState("pla")

  return (
    <Page3DDruck
      selectedMaterial={selectedMaterial}
      setSelectedMaterial={setSelectedMaterial}
      setCurrentView={navigate}
    />
  )
}
