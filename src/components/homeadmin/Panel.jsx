import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

/** One block of the front-page chatbot settings. */
export default function Panel({ title, description, action, children }) {
  return (
    <Card className="border-slate-200 shadow-sm">
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0 pb-3">
        <div className="min-w-0">
          <CardTitle className="text-base font-semibold text-slate-900">{title}</CardTitle>
          {description && <p className="mt-1 text-xs leading-relaxed text-slate-500">{description}</p>}
        </div>
        {action}
      </CardHeader>
      <CardContent className="space-y-3">{children}</CardContent>
    </Card>
  );
}