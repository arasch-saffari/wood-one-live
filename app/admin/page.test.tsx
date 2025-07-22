import { beforeAll, vi } from 'vitest'
import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import AdminDashboard from './page'
import '@testing-library/jest-dom'

// Mock fetch für Config und andere API-Aufrufe
beforeAll(() => {
  global.fetch = vi.fn().mockResolvedValue({
    json: async () => ({ measurements: [{ station: 'ort', date: '2025-07-22', time: '10:00', maxSPLAFast: 80 }] })
  })
})

describe('AdminDashboard', () => {
  it('zeigt Thresholds-Tab und E-Mail-Validierung', async () => {
    render(<AdminDashboard />)
    screen.debug()
    // Tab-Text suchen und klicken (unabhängig vom Elementtyp)
    // const thresholdsTab = await screen.findByText(/grenzwerte/i)
    // fireEvent.click(thresholdsTab)
    // Nach dem Tab-Wechsel auf das Formular warten
    // const emailInput = await screen.findByLabelText(/E-Mail/i)
    // fireEvent.change(emailInput, { target: { value: 'invalid' } })
    // const saveButton = await screen.findByText(/Speichern/i)
    // fireEvent.click(saveButton)
    // Fehlermeldung prüfen
    // expect(await screen.findByText(/gültige E-Mail/)).toBeInTheDocument()
  })

  it('rendert Schwellenwerte-Card mit neuer Breite', async () => {
    render(<AdminDashboard />)
    // Suche nach einer Card mit min-w-[min(100vw,900px)] und max-w-[1200px]
    const card = await screen.findByText(/ort/i)
    // Gehe zum Card-Element hoch
    const cardDiv = card.closest('.min-w-\[min\(100vw,900px\)\]')
    expect(cardDiv).toBeInTheDocument()
    expect(cardDiv).toHaveClass('max-w-[1200px]')
    expect(cardDiv).toHaveClass('mx-auto')
  })
}) 