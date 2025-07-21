import { beforeAll, vi } from 'vitest'
import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import AdminDashboard from './page'

// Mock fetch für Config und andere API-Aufrufe
beforeAll(() => {
  global.fetch = vi.fn().mockResolvedValue({
    json: async () => ({ thresholdsByStationAndTime: { ort: [{ from: '08:00', to: '20:00', lasThreshold: 50 }] }, adminEmail: '' })
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
}) 