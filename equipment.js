const EQUIPMENT_REGISTRY = [
  {
    id: "SCAFF-001",
    type: "Mobile Scaffold Tower",
    location: "Warehouse A - Bay 3",
    height: "6m",
    last_inspection: "2024-09-15",
    status: "active",
    notes: "Standard aluminum tower"
  },
  {
    id: "SCAFF-002",
    type: "Mobile Scaffold Tower",
    location: "Warehouse A - Bay 5",
    height: "8m",
    last_inspection: "2024-09-20",
    status: "active",
    notes: "Heavy duty model"
  },
  {
    id: "SCAFF-003",
    type: "Fixed Frame Scaffold",
    location: "Building B - North Wall",
    height: "12m",
    last_inspection: "2024-08-30",
    status: "active",
    notes: "Multi-level setup"
  },
  {
    id: "SCAFF-004",
    type: "Mobile Scaffold Tower",
    location: "Warehouse C - Loading Dock",
    height: "4m",
    last_inspection: "2024-09-10",
    status: "active",
    notes: "Compact model for low clearance"
  },
  {
    id: "SCAFF-005",
    type: "Suspended Scaffold",
    location: "Building D - East Facade",
    height: "15m",
    last_inspection: "2024-09-05",
    status: "active",
    notes: "Requires daily inspection"
  },
  {
    id: "SCAFF-006",
    type: "Fixed Frame Scaffold",
    location: "Manufacturing Floor 1",
    height: "10m",
    last_inspection: "2024-09-18",
    status: "active",
    notes: "Production area access"
  },
  {
    id: "SCAFF-007",
    type: "Mobile Scaffold Tower",
    location: "Warehouse A - Bay 1",
    height: "6m",
    last_inspection: "2024-09-22",
    status: "active",
    notes: "Recently serviced"
  },
  {
    id: "SCAFF-008",
    type: "Rolling Scaffold",
    location: "Building E - Main Hall",
    height: "8m",
    last_inspection: "2024-08-25",
    status: "maintenance",
    notes: "Under maintenance - wheels being replaced"
  },
  {
    id: "SCAFF-009",
    type: "Fixed Frame Scaffold",
    location: "Warehouse B - Storage Area",
    height: "14m",
    last_inspection: "2024-09-12",
    status: "active",
    notes: "High-reach configuration"
  },
  {
    id: "SCAFF-010",
    type: "Mobile Scaffold Tower",
    location: "Building C - Workshop",
    height: "5m",
    last_inspection: "2024-09-25",
    status: "active",
    notes: "Workshop maintenance unit"
  },
  {
    id: "SCAFF-011",
    type: "Cantilever Scaffold",
    location: "Building F - Exterior",
    height: "20m",
    last_inspection: "2024-09-01",
    status: "active",
    notes: "Special configuration for facade work"
  },
  {
    id: "SCAFF-012",
    type: "Mobile Scaffold Tower",
    location: "Warehouse D - Receiving",
    height: "6m",
    last_inspection: "2024-09-19",
    status: "active",
    notes: "Standard configuration"
  },
  {
    id: "SCAFF-013",
    type: "Fixed Frame Scaffold",
    location: "Manufacturing Floor 2",
    height: "12m",
    last_inspection: "2024-08-28",
    status: "active",
    notes: "Permanent installation"
  },
  {
    id: "SCAFF-014",
    type: "Mobile Scaffold Tower",
    location: "Building G - Maintenance Shop",
    height: "7m",
    last_inspection: "2024-09-24",
    status: "active",
    notes: "Maintenance department use"
  },
  {
    id: "SCAFF-015",
    type: "Suspended Scaffold",
    location: "Building H - South Facade",
    height: "18m",
    last_inspection: "2024-09-08",
    status: "active",
    notes: "Window cleaning and maintenance"
  }
];

export function getAllEquipment() {
  return EQUIPMENT_REGISTRY;
}

export function getEquipmentById(id) {
  const normalizedId = id.trim().toUpperCase();
  return EQUIPMENT_REGISTRY.find(
    eq => eq.id.toUpperCase() === normalizedId
  );
}

export function searchEquipmentByLocation(locationQuery) {
  const query = locationQuery.toLowerCase();
  return EQUIPMENT_REGISTRY.filter(
    eq => eq.location.toLowerCase().includes(query)
  );
}

export function getEquipmentByStatus(status) {
  return EQUIPMENT_REGISTRY.filter(
    eq => eq.status === status
  );
}

export function getEquipmentStats() {
  const total = EQUIPMENT_REGISTRY.length;
  const byStatus = EQUIPMENT_REGISTRY.reduce((acc, eq) => {
    acc[eq.status] = (acc[eq.status] || 0) + 1;
    return acc;
  }, {});
  
  const byType = EQUIPMENT_REGISTRY.reduce((acc, eq) => {
    acc[eq.type] = (acc[eq.type] || 0) + 1;
    return acc;
  }, {});

  return {
    total,
    byStatus,
    byType
  };
}

export default {
  getAllEquipment,
  getEquipmentById,
  searchEquipmentByLocation,
  getEquipmentByStatus,
  getEquipmentStats
};
