import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase-admin'

// Add dynamic routing to prevent build-time eval
export const dynamic = 'force-dynamic';

// GET /api/v2/cars - Get all cars from Supabase
export async function GET(request: NextRequest) {
  try {
    // Query Supabase for cars
    const { data, error } = await supabase
      .from('cars')
      .select('*')
      .order('name')
    
    if (error) {
      console.error('Error fetching cars from Supabase:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    
    return NextResponse.json({ data })
  } catch (error: any) {
    console.error('v2/cars API error:', error)
    return NextResponse.json(
      { error: error.message || 'Unknown error' }, 
      { status: 500 }
    )
  }
}