import { DataProvider } from './ports';
import { Driver, Bus, Route, Trip, Payment, SOSEvent, Settings } from './types';
import { 
  mockDrivers, 
  mockBuses, 
  mockRoutes, 
  mockTrips, 
  mockPayments, 
  mockSOSEvents, 
  mockSettings,
  mockPeakHours,
  mockPeakRoutes
} from './mockData';

// Mock implementation - stores data in memory
// TODO: Replace with Firebase implementation
export class MockDataProvider implements DataProvider {
  private drivers: Driver[] = [...mockDrivers];
  private buses: Bus[] = [...mockBuses];
  private routes: Route[] = [...mockRoutes];
  private trips: Trip[] = [...mockTrips];
  private payments: Payment[] = [...mockPayments];
  private sosEvents: SOSEvent[] = [...mockSOSEvents];
  private settings: Settings = { ...mockSettings };

  async getSettings(): Promise<Settings> {
    return Promise.resolve({ ...this.settings });
  }

  async updateSettings(s: Partial<Settings>): Promise<void> {
    this.settings = { ...this.settings, ...s };
    return Promise.resolve();
  }

  async listDrivers(status?: string): Promise<Driver[]> {
    if (status) {
      return Promise.resolve(this.drivers.filter(d => d.status === status));
    }
    return Promise.resolve([...this.drivers]);
  }

  async createDriver(input: { fullName: string; phone: string }): Promise<Driver> {
    const newDriver: Driver = {
      id: `driver-${Date.now()}`,
      fullName: input.fullName,
      phone: input.phone,
      rating: 0,
      joinedAt: new Date(),
      status: "pending",
      totalDistanceKm: 0,
      totalTrips: 0
    };
    
    this.drivers.push(newDriver);
    return Promise.resolve({ ...newDriver });
  }

  async approveAndAssignDriver(input: { driverId: string; busId: string; routeIds: string[] }): Promise<void> {
    const driverIndex = this.drivers.findIndex(d => d.id === input.driverId);
    const busIndex = this.buses.findIndex(b => b.id === input.busId);
    
    if (driverIndex !== -1) {
      this.drivers[driverIndex] = {
        ...this.drivers[driverIndex],
        status: "approved",
        assignedBusId: input.busId,
        assignedRouteIds: input.routeIds
      };
    }
    
    if (busIndex !== -1) {
      this.buses[busIndex] = {
        ...this.buses[busIndex],
        assignedDriverId: input.driverId
      };
    }
    
    return Promise.resolve();
  }

  async listBuses(): Promise<Bus[]> {
    return Promise.resolve([...this.buses]);
  }

  async createBus(input: { busNumber: string; vehicleType: 'bus' | 'miniBus' | 'auto' | 'other'; notes?: string }): Promise<Bus> {
    const newBus: Bus = {
      id: `bus-${Date.now()}`,
      busNumber: input.busNumber,
      vehicleType: input.vehicleType,
      active: true,
      notes: input.notes
    };
    
    this.buses.push(newBus);
    return Promise.resolve({ ...newBus });
  }

  async listRoutes(): Promise<Route[]> {
    return Promise.resolve([...this.routes]);
  }

  async createRoute(input: { name: string; code: string; priorityScore: number }): Promise<Route> {
    const newRoute: Route = {
      id: `route-${Date.now()}`,
      name: input.name,
      code: input.code,
      priorityScore: input.priorityScore
    };
    
    this.routes.push(newRoute);
    return Promise.resolve({ ...newRoute });
  }

  async listTrips(params?: { driverId?: string; routeId?: string; limit?: number }): Promise<Trip[]> {
    let filtered = [...this.trips];
    
    if (params?.driverId) {
      filtered = filtered.filter(t => t.driverId === params.driverId);
    }
    
    if (params?.routeId) {
      filtered = filtered.filter(t => t.routeId === params.routeId);
    }
    
    if (params?.limit) {
      filtered = filtered.slice(0, params.limit);
    }
    
    return Promise.resolve(filtered);
  }

  async listPeakHours(): Promise<{ hour: number; riders: number }[]> {
    return Promise.resolve([...mockPeakHours]);
  }

  async listPeakRoutes(): Promise<{ routeId: string; routeName: string; riders: number }[]> {
    return Promise.resolve([...mockPeakRoutes]);
  }

  async listPayments(params?: { from?: Date; to?: Date }): Promise<Payment[]> {
    let filtered = [...this.payments];
    
    if (params?.from) {
      filtered = filtered.filter(p => p.createdAt >= params.from!);
    }
    
    if (params?.to) {
      filtered = filtered.filter(p => p.createdAt <= params.to!);
    }
    
    return Promise.resolve(filtered);
  }

  async getRevenueSummary(): Promise<{ today: number; week: number; month: number }> {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
    
    const successfulPayments = this.payments.filter(p => p.status === 'success');
    
    const todayRevenue = successfulPayments
      .filter(p => p.createdAt >= today)
      .reduce((sum, p) => sum + p.amount, 0);
    
    const weekRevenue = successfulPayments
      .filter(p => p.createdAt >= weekAgo)
      .reduce((sum, p) => sum + p.amount, 0);
    
    const monthRevenue = successfulPayments
      .filter(p => p.createdAt >= monthAgo)
      .reduce((sum, p) => sum + p.amount, 0);
    
    return Promise.resolve({
      today: todayRevenue,
      week: weekRevenue,
      month: monthRevenue
    });
  }

  async listSOSEvents(status?: string): Promise<SOSEvent[]> {
    if (status) {
      return Promise.resolve(this.sosEvents.filter(s => s.status === status));
    }
    return Promise.resolve([...this.sosEvents]);
  }

  async updateSOS(id: string, status: "ack" | "closed"): Promise<void> {
    const eventIndex = this.sosEvents.findIndex(s => s.id === id);
    if (eventIndex !== -1) {
      this.sosEvents[eventIndex] = {
        ...this.sosEvents[eventIndex],
        status
      };
    }
    return Promise.resolve();
  }

  async listLeaderboard(): Promise<{ byTenure: Driver[]; byDistance: Driver[] }> {
    const approvedDrivers = this.drivers.filter(d => d.status === 'approved');
    
    const byTenure = [...approvedDrivers].sort((a, b) => a.joinedAt.getTime() - b.joinedAt.getTime());
    const byDistance = [...approvedDrivers].sort((a, b) => (b.totalDistanceKm || 0) - (a.totalDistanceKm || 0));
    
    return Promise.resolve({ byTenure, byDistance });
  }
}
