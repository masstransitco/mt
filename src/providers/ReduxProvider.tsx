/* ------------------------------------------------------------------
   ReduxProvider – wraps the entire app with Redux + Redux-Persist.
   Blocks rendering until the store is fully re-hydrated.
   ----------------------------------------------------------------- */
   "use client";

   import type { ReactNode } from "react";
   import { Provider } from "react-redux";
   import { PersistGate } from "redux-persist/integration/react";
   
   import { store, persistor } from "@/store/store";
   import Spinner from "@/components/ui/spinner"; // replace with your own loader
   
   interface ReduxProviderProps {
     children: ReactNode;
   }
   
   export default function ReduxProvider({ children }: ReduxProviderProps) {
     return (
       <Provider store={store}>
         {/* PersistGate prevents any UI from mounting until REHYDRATE finishes */}
         <PersistGate loading={<Spinner size="lg" />} persistor={persistor}>
           {children}
         </PersistGate>
       </Provider>
     );
   }