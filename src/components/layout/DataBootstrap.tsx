"use client";

import { useEffect } from "react";
import { useStore } from "@/store/useStore";

export function DataBootstrap() {
  const { fetchProperties, fetchTenants, fetchAllTenants, fetchPayments } = useStore();

  useEffect(() => {
    fetchPayments();
    fetchAllTenants();
    fetchProperties().then(() => fetchTenants());
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
