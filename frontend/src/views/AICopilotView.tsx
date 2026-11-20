import React from 'react';
import { AICopilot } from '../components/AICopilot';

export const AICopilotView: React.FC = () => {
  return (
    <div className="flex-1 flex flex-col p-6 overflow-hidden">
      <AICopilot isEmbedded={false} />
    </div>
  );
};
