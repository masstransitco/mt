import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { StationFeature } from './stationsSlice';
import { RootState } from './store';
import { StationAiInfo } from '@/lib/stationAiUtils';

interface StationAiState {
  stationInfo: Record<number, StationAiInfo>;
  loading: boolean;
  error: string | null;
  activeStationId: number | null;
  language: 'en' | 'zh-TW';
}

const initialState: StationAiState = {
  stationInfo: {},
  loading: false,
  error: null,
  activeStationId: null,
  language: 'en',
};

// Async thunk for fetching station AI information
export const fetchStationInfo = createAsyncThunk(
  'stationAi/fetchStationInfo',
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
      // Direct API call instead of using the imported function
      const response = await fetch('/api/station-ai', {
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
        throw new Error('Failed to fetch station AI information');
      }

      const info = await response.json();
      
      return {
        stationId: station.id,
        info,
      };
    } catch (error) {
      console.error('Error fetching station AI info:', error);
      return rejectWithValue('Failed to fetch station information');
    }
  }
);

const stationAiSlice = createSlice({
  name: 'stationAi',
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
} = stationAiSlice.actions;

// Selectors
export const selectStationAiLoading = (state: RootState) => state.stationAi.loading;
export const selectStationAiError = (state: RootState) => state.stationAi.error;
export const selectActiveStationId = (state: RootState) => state.stationAi.activeStationId;
export const selectLanguage = (state: RootState) => state.stationAi.language;

export const selectActiveStationInfo = (state: RootState) => {
  const activeId = state.stationAi.activeStationId;
  return activeId ? state.stationAi.stationInfo[activeId] : null;
};

export const selectStationInfoById = (state: RootState, stationId: number) => {
  return state.stationAi.stationInfo[stationId] || null;
};

export default stationAiSlice.reducer;