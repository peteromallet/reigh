import React from 'react';
import { Outlet } from 'react-router-dom';
import { GlobalHeader } from '@/shared/components/GlobalHeader';

const Layout: React.FC = () => {
  return (
    <div className="flex flex-col min-h-screen">
      <GlobalHeader />
      <main className="flex-grow container mx-auto py-4 px-4 md:px-6">
        <Outlet /> 
      </main>
      {/* You can add a GlobalFooter here if needed */}
    </div>
  );
};

export default Layout; 