"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

interface PhoneInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
}

export function PhoneInput({ className, label = "Phone number", error, ...props }: PhoneInputProps) {
  const [value, setValue] = React.useState(props.value || "")

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Only allow numbers, spaces, dashes, and parentheses
    const cleaned = e.target.value.replace(/[^\d\s\-()]/g, "")
    setValue(cleaned)
    if (props.onChange) {
      e.target.value = cleaned
      props.onChange(e)
    }
  }

  return (
    <div className="space-y-2">
      {label && <Label htmlFor={props.id}>{label}</Label>}
      <Input
        type="tel"
        className={cn(
          "bg-[#1a1a1a] border-[#2a2a2a] focus:border-[#10a37f] focus:ring-[#10a37f]/20",
          error && "border-red-500 focus:border-red-500 focus:ring-red-500/20",
          className,
        )}
        value={value}
        onChange={handleChange}
        {...props}
      />
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  )
}

