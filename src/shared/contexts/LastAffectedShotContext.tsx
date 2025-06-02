import { createContext, useState, Dispatch, SetStateAction, ReactNode } from 'react';

interface LastAffectedShotContextType {
  lastAffectedShotId: string | null;
  setLastAffectedShotId: Dispatch<SetStateAction<string | null>>;
}

export const LastAffectedShotContext = createContext<LastAffectedShotContextType | undefined>(
  undefined
);

export function LastAffectedShotProvider({ children }: { children: ReactNode }) {
  const [lastAffectedShotId, setLastAffectedShotId] = useState<string | null>(null);

  return (
    <LastAffectedShotContext.Provider value={{ lastAffectedShotId, setLastAffectedShotId }}>
      {children}
    </LastAffectedShotContext.Provider>
  );
} 