import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase-admin'

// Add dynamic routing to prevent build-time eval
export const dynamic = 'force-dynamic';

// GET /api/v2/cars/:id - Get car by ID
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = params.id
    
    // Query Supabase for specific car
    const { data, error } = await supabase
      .from('cars')
      .select('*')
      .eq('id', id)
      .single()
    
    if (error) {
      console.error(`Error fetching car ${id} from Supabase:`, error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    
    return NextResponse.json({ data })
  } catch (error: any) {
    console.error('v2/cars car detail API error:', error)
    return NextResponse.json(
      { error: error.message || 'Unknown error' }, 
      { status: 500 }
    )
  }
}

// PUT /api/v2/cars/:id - Update car by ID
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = params.id
    const body = await request.json()
    
    // Update car in Supabase
    const { data, error } = await supabase
      .from('cars')
      .update(body)
      .eq('id', id)
      .select()
      .single()
    
    if (error) {
      console.error(`Error updating car ${id} in Supabase:`, error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    
    return NextResponse.json({ data })
  } catch (error: any) {
    console.error('v2/cars car update API error:', error)
    return NextResponse.json(
      { error: error.message || 'Unknown error' }, 
      { status: 500 }
    )
  }
}