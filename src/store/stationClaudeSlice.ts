import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { StationFeature } from './stationsSlice';
import { RootState } from './store';
import { StationAiInfo } from '@/lib/stationAiUtils';

interface StationClaudeState {
  stationInfo: Record<number, StationAiInfo>;
  loading: boolean;
  error: string | null;
  activeStationId: number | null;
  language: 'en' | 'zh-TW';
}

const initialState: StationClaudeState = {
  stationInfo: {},
  loading: false,
  error: null,
  activeStationId: null,
  language: 'en',
};

// Async thunk for fetching station AI information using Claude
export const fetchStationInfo = createAsyncThunk(
  'stationClaude/fetchStationInfo',
  async ({ 
    station, 
    language, 
    sections = ['basic', 'environmental', 'transport', 'places', 'safety', 'cultural'] 
  }: { 
    station: StationFeature; 
    language?: 'en' | 'zh-TW';
    sections?: string[];
  }, { rejectWithValue }) => {
    try {
      console.log('Fetching station info with Claude for:', station.id, language, sections);
      
      // Make API call to Claude endpoint
      const response = await fetch('/api/station-claude', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          station,
          language: language || 'en',
          sections,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('Failed to fetch station Claude information:', errorData);
        throw new Error('Failed to fetch station Claude information');
      }

      const info = await response.json();
      console.log('Claude API response received:', Object.keys(info));
      
      return {
        stationId: station.id,
        info,
      };
    } catch (error) {
      console.error('Error fetching station Claude info:', error);
      return rejectWithValue('Failed to fetch station information');
    }
  }
);

const stationClaudeSlice = createSlice({
  name: 'stationClaude',
  initialState,
  reducers: {
    setActiveStation: (state, action: PayloadAction<number | null>) => {
      state.activeStationId = action.payload;
    },
    clearStationInfo: (state, action: PayloadAction<number>) => {
      delete state.stationInfo[action.payload];
    },
    clearAllStationInfo: (state) => {
      state.stationInfo = {};
      state.activeStationId = null;
    },
    setLanguage: (state, action: PayloadAction<'en' | 'zh-TW'>) => {
      state.language = action.payload;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchStationInfo.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchStationInfo.fulfilled, (state, action) => {
        const { stationId, info } = action.payload;
        state.loading = false;
        state.stationInfo[stationId] = {
          ...state.stationInfo[stationId],
          ...info,
          isLoading: false
        };
      })
      .addCase(fetchStationInfo.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string || 'An error occurred';
      });
  },
});

// Actions
export const { 
  setActiveStation, 
  clearStationInfo, 
  clearAllStationInfo,
  setLanguage
} = stationClaudeSlice.actions;

// Selectors
export const selectStationClaudeLoading = (state: RootState) => state.stationClaude.loading;
export const selectStationClaudeError = (state: RootState) => state.stationClaude.error;
export const selectActiveStationId = (state: RootState) => state.stationClaude.activeStationId;
export const selectLanguage = (state: RootState) => state.stationClaude.language;

export const selectActiveStationInfo = (state: RootState) => {
  const activeId = state.stationClaude.activeStationId;
  const info = activeId ? state.stationClaude.stationInfo[activeId] : null;
  console.log("selectActiveStationInfo", { activeId, hasInfo: !!info, infoKeys: info ? Object.keys(info) : [] });
  return info;
};

export const selectStationInfoById = (state: RootState, stationId: number) => {
  return state.stationClaude.stationInfo[stationId] || null;
};

export default stationClaudeSlice.reducer;