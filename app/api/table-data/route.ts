import { NextRequest, NextResponse } from 'next/server'
import { getAllStationsTableData } from '@/lib/table-data-service'
import { apiLatency } from '../metrics/route'

export async function GET(req: NextRequest) {
  const apiLatencyEnd = apiLatency.startTimer({ route: '/api/table-data' })
  
  try {
    const { searchParams } = new URL(req.url)
    
    const options = {
      page: parseInt(searchParams.get('page') || '1', 10),
      pageSize: parseInt(searchParams.get('pageSize') || '25', 10),
      sortBy: searchParams.get('sortBy') || 'datetime',
      sortOrder: (searchParams.get('sortOrder') || 'desc') as 'asc' | 'desc',
      station: searchParams.get('station') || undefined,
      dateFilter: searchParams.get('dateFilter') || undefined,
      searchQuery: searchParams.get('searchQuery') || undefined,
      showOnlyAlarms: searchParams.get('showOnlyAlarms') === 'true'
    }

    // Parameter-Validierung
    if (options.page < 1) options.page = 1
    if (options.pageSize < 1) options.pageSize = 25
    if (options.pageSize > 1000) options.pageSize = 1000

    const result = getAllStationsTableData(options)
    
    apiLatencyEnd()
    
    return NextResponse.json({
      success: true,
      ...result
    })
    
  } catch (error) {
    apiLatencyEnd()
    console.error('[API table-data] Fehler:', error)
    
    return NextResponse.json({
      success: false,
      error: 'Fehler beim Laden der Tabellendaten',
      data: [],
      totalCount: 0,
      page: 1,
      pageSize: 25,
      totalPages: 0
    }, { status: 500 })
  }
}