import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase-admin'

// Add dynamic routing to prevent build-time eval
export const dynamic = 'force-dynamic';

// GET /api/v2/buffer-settings - Get all buffer settings from Supabase
export async function GET(request: NextRequest) {
  try {
    // Query Supabase for buffer settings
    const { data, error } = await supabase
      .from('buffer_time_settings')
      .select('*')
      .order('order')
    
    if (error) {
      console.error('Error fetching buffer settings from Supabase:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    
    return NextResponse.json({ data })
  } catch (error: any) {
    console.error('v2/buffer-settings API error:', error)
    return NextResponse.json(
      { error: error.message || 'Unknown error' }, 
      { status: 500 }
    )
  }
}

// PUT /api/v2/buffer-settings - Update multiple buffer settings
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { settings } = body
    
    if (!Array.isArray(settings) || settings.length === 0) {
      return NextResponse.json(
        { error: 'Invalid settings data' }, 
        { status: 400 }
      )
    }
    
    // Define the type for the results array
    type ResultItem = {
      key: string | null;
      error?: string;
      data?: any;
    }
    
    // Process each setting update
    const results: ResultItem[] = []
    for (const setting of settings) {
      const { key, value } = setting
      
      if (!key) {
        results.push({ key, error: 'Missing key' })
        continue
      }
      
      // Update the setting in Supabase
      const { data, error } = await supabase
        .from('buffer_time_settings')
        .update({ 
          value, 
          updatedAt: new Date().toISOString() 
        })
        .eq('key', key)
        .select()
      
      if (error) {
        console.error(`Error updating buffer setting ${key}:`, error)
        results.push({ key, error: error.message })
      } else {
        results.push({ key, data: data[0] })
      }
    }
    
    return NextResponse.json({ results })
  } catch (error: any) {
    console.error('v2/buffer-settings update API error:', error)
    return NextResponse.json(
      { error: error.message || 'Unknown error' }, 
      { status: 500 }
    )
  }
}
