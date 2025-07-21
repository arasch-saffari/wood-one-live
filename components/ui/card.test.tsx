import React from 'react'
import '@testing-library/jest-dom'
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { Card, CardHeader, CardTitle, CardContent } from './card'

describe('Card', () => {
  it('rendert Titel und Inhalt', () => {
    render(
      <Card>
        <CardHeader>
          <CardTitle>Test-Titel</CardTitle>
        </CardHeader>
        <CardContent>Test-Inhalt</CardContent>
      </Card>
    )
    expect(screen.getByText('Test-Titel')).toBeInTheDocument()
    expect(screen.getByText('Test-Inhalt')).toBeInTheDocument()
  })
}) 