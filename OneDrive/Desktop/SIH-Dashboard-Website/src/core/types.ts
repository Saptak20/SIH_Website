export interface Driver {
  id: string;
  fullName: string;
  phone: string;
  email?: string;
  rating: number;
  joinedAt: Date;
  status: "pending" | "approved" | "inactive";
  assignedBusId?: string;
  assignedRouteIds?: string[];
  totalDistanceKm?: number;
  totalTrips?: number;
}

export interface Bus {
  id: string;
  busNumber: string;
  vehicleType: "bus" | "miniBus" | "auto" | "other";
  active: boolean;
  assignedDriverId?: string;
  notes?: string;
  currentLocation?: { lat: number; lng: number };
  fuelEfficiency?: number;
}

export interface Route {
  id: string;
  name: string;
  code: string;
  priorityScore: number;
  startLocation?: string;
  endLocation?: string;
  distanceKm?: number;
  estimatedDurationMinutes?: number;
  waypoints?: { lat: number; lng: number; name: string }[];
}

export interface Trip {
  id: string;
  passengerId?: string;
  driverId: string;
  busId: string;
  routeId: string;
  distance?: number;
  cost?: number;
  accepted?: boolean;
  started?: boolean;
  canceled?: boolean;
  arrived?: boolean;
  reachedDestination?: boolean;
  tripCompleted?: boolean;
  startedAt?: Date;
  endedAt?: Date;
  fuelPricePerLitre?: number;
  pickupLocation?: { lat: number; lng: number; address: string };
  dropoffLocation?: { lat: number; lng: number; address: string };
}

export interface Payment {
  id: string;
  tripId: string;
  amount: number;
  paymentMethod: "cash" | "card" | "upi" | "wallet";
  status: "pending" | "completed" | "failed" | "refunded";
  transactionId?: string;
  paymentGateway?: string;
  createdAt: Date;
}

export interface SOSEvent {
  id: string;
  driverId: string;
  busId?: string;
  location: { lat: number; lng: number };
  address?: string;
  type: "emergency" | "breakdown" | "accident" | "medical" | "security";
  description?: string;
  status: "active" | "resolved" | "dismissed";
  priority: "low" | "medium" | "high" | "critical";
  resolvedAt?: Date;
  resolvedBy?: string;
  createdAt: Date;
}

export interface PeakMetric {
  date: string;
  hour: number;
  routeId: string;
  riders: number;
  trips: number;
}

export interface Settings {
  fuelPricePerLitre: number;
  baseFare: number;
  pricePerKm: number;
  maxTripDistance: number;
  sosAutoResolveMinutes: number;
  enablePushNotifications: boolean;
  commissionPercentage: number;
  driverApprovalRequired: boolean;
  analyticsDataRetentionDays: number;
  maintenanceMode: boolean;
}
