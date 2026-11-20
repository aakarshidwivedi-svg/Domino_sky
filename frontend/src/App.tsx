import React from 'react';
import { OperationalProvider } from './context/OperationalContext';
import { AppShell } from './components/AppShell';

export const App: React.FC = () => {
  return (
    <OperationalProvider>
      <AppShell />
    </OperationalProvider>
  );
};

export default App;
