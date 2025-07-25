import { NextRequest } from 'next/server'
import { getAllStationsTableData } from '@/lib/table-data-service'
import { apiLatency } from '../metrics/route'
// Import middleware with fallbacks
let withErrorHandler: any = null;
let ApiResponse: any = null;
let withRateLimit: any = null;
let validateRequest: any = null;
let getTableDataSchema: any = null;

try {
  const errorModule = require('@/lib/middleware/error-handler');
  withErrorHandler = errorModule.withErrorHandler;
  ApiResponse = errorModule.ApiResponse;
} catch (error) {
  console.warn('Error handler middleware not available');
}

try {
  const rateLimitModule = require('@/lib/middleware/rate-limit');
  withRateLimit = rateLimitModule.withRateLimit;
} catch (error) {
  console.warn('Rate limit middleware not available');
}

try {
  const validationModule = require('@/lib/validation');
  validateRequest = validationModule.validateRequest;
  getTableDataSchema = validationModule.getTableDataSchema;
} catch (error) {
  console.warn('Validation module not available');
}
import { logger } from '@/lib/logger'

async function GET(req: NextRequest) {
  const apiLatencyEnd = apiLatency.startTimer({ route: '/api/table-data' })
  
  try {
    const { searchParams } = new URL(req.url)
    
    // Extract parameters with basic validation
    // Filter out null values to avoid validation issues
    const rawOptions: any = {};
    
    const page = searchParams.get('page');
    if (page !== null) rawOptions.page = page;
    
    const pageSize = searchParams.get('pageSize');
    if (pageSize !== null) rawOptions.pageSize = pageSize;
    
    const sortBy = searchParams.get('sortBy');
    if (sortBy !== null) rawOptions.sortBy = sortBy;
    
    const sortOrder = searchParams.get('sortOrder');
    if (sortOrder !== null) rawOptions.sortOrder = sortOrder;
    
    const station = searchParams.get('station');
    if (station !== null) rawOptions.station = station;
    
    const dateFilter = searchParams.get('dateFilter');
    if (dateFilter !== null) rawOptions.dateFilter = dateFilter;
    
    const startDate = searchParams.get('startDate');
    if (startDate !== null) rawOptions.startDate = startDate;
    
    const endDate = searchParams.get('endDate');
    if (endDate !== null) rawOptions.endDate = endDate;
    
    const searchQuery = searchParams.get('searchQuery');
    if (searchQuery !== null) rawOptions.searchQuery = searchQuery;
    
    const showOnlyAlarms = searchParams.get('showOnlyAlarms');
    if (showOnlyAlarms !== null) rawOptions.showOnlyAlarms = showOnlyAlarms === 'true';

    // Use validation if available, otherwise use basic parameter processing
    let processedOptions = rawOptions;
    if (validateRequest && getTableDataSchema) {
      try {
        const validation = validateRequest(getTableDataSchema, rawOptions);
        if (!validation.success) {
          apiLatencyEnd()
          if (ApiResponse) {
            return ApiResponse.validationError(validation.errors);
          } else {
            return new Response(JSON.stringify({
              success: false,
              error: 'Validation failed',
              details: validation.errors
            }), { status: 400, headers: { 'Content-Type': 'application/json' } });
          }
        }
        processedOptions = validation.data;
      } catch (validationError) {
        logger.warn({ error: validationError }, 'Validation failed, using basic processing');
      }
    }

    // Basic parameter validation fallback
    const options = {
      page: parseInt(processedOptions.page || '1', 10),
      pageSize: parseInt(processedOptions.pageSize || '25', 10),
      sortBy: processedOptions.sortBy || 'datetime',
      sortOrder: (processedOptions.sortOrder || 'desc') as 'asc' | 'desc',
      station: processedOptions.station || undefined,
      dateFilter: processedOptions.dateFilter || undefined,
      startDate: processedOptions.startDate || undefined,
      endDate: processedOptions.endDate || undefined,
      searchQuery: processedOptions.searchQuery || undefined,
      showOnlyAlarms: processedOptions.showOnlyAlarms || false
    };

    // Parameter validation
    if (options.page < 1) options.page = 1;
    if (options.pageSize < 1) options.pageSize = 25;
    if (options.pageSize > 1000) options.pageSize = 1000;

    logger.info({ 
      options,
      userAgent: req.headers.get('user-agent'),
      ip: req.headers.get('x-forwarded-for') || req.ip
    }, 'Table data request received');

    const result = await getAllStationsTableData(options)
    
    apiLatencyEnd()
    
    const response = {
      success: true,
      ...result,
      requestId: crypto.randomUUID() // Add request ID for debugging
    };
    
    if (ApiResponse) {
      return ApiResponse.success(response);
    } else {
      return new Response(JSON.stringify(response), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
  } catch (error) {
    apiLatencyEnd()
    logger.error({ error }, 'Table data API error');
    
    const errorResponse = {
      success: false,
      error: 'Failed to fetch table data',
      message: process.env.NODE_ENV === 'development' ? (error as Error).message : 'Internal server error'
    };
    
    if (ApiResponse) {
      return ApiResponse.error(errorResponse.error, 500);
    } else {
      return new Response(JSON.stringify(errorResponse), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }
}

// Apply middleware if available, otherwise export the basic function
let finalGET = GET;

if (withErrorHandler) {
  finalGET = withErrorHandler(finalGET);
}

if (withRateLimit) {
  finalGET = withRateLimit(finalGET);
}

export { finalGET as GET };