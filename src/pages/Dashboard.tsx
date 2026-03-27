import React, { useEffect } from 'react';
import { useAppStore } from '../lib/store';
import Statistics from './Statistics';

export default function Dashboard() {
  const { fetchTeachers, fetchClassGroups, fetchCoursePlans } = useAppStore();

  useEffect(() => {
    fetchTeachers();
    fetchClassGroups();

    fetchCoursePlans();
  }, []);

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-6">
      <Statistics embedded={true} />
    </div>
  );
}
