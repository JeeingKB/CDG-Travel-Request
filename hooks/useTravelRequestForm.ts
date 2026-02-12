
import { useState, useEffect, useCallback } from 'react';
import { 
    TravelRequest, RequestFor, TravelType, TravelerDetails, 
    TripSummary, TravelServiceItem, ServiceType, RequestStatus 
} from '../types';
import { calculateSLADeadline } from '../services/slaService';
import { getDailyPerDiem } from '../services/policyRules';
import { storageService } from '../services/storage';
import { useAuth } from '../contexts/AuthContext'; // NEW

// Initial Empty User (Waiting for Auth/Context)
const EMPTY_USER: TravelerDetails = {
    id: '',
    title: 'Mr.',
    name: '',
    department: '',
    type: 'Employee',
    jobGrade: 0,
    position: 'Staff'
};

const DEFAULT_TRIP: TripSummary = {
    origin: 'Bangkok',
    destination: '',
    startDate: '',
    endDate: '',
    purpose: '',
    justification: '',
    projectCode: '',
    costCenter: '',
};

export const useTravelRequestForm = (initialData?: Partial<TravelRequest> | null) => {
    // --- Context ---
    const { employeeDetails } = useAuth(); // Get mapped employee details from auth

    // --- State ---
    const [requestFor, setRequestFor] = useState<RequestFor>(RequestFor.SELF);
    const [travelType, setTravelType] = useState<TravelType>(TravelType.DOMESTIC);
    const [travelers, setTravelers] = useState<TravelerDetails[]>([]);
    const [trip, setTrip] = useState<TripSummary>(DEFAULT_TRIP);
    const [services, setServices] = useState<TravelServiceItem[]>([]);
    const [estimatedCost, setEstimatedCost] = useState<number>(0);
    const [allEmployees, setAllEmployees] = useState<any[]>([]);

    // --- Load Context (User & Employees) ---
    useEffect(() => {
        const loadContext = async () => {
            const employees = await storageService.getEmployees();
            setAllEmployees(employees);

            // Set initial travelers based on logged in user
            if (employeeDetails && !initialData) {
                setTravelers([employeeDetails]);
            } else if (!initialData) {
                // Fallback safe guard
                setTravelers([{ ...EMPTY_USER, name: 'Loading...' }]);
            }
        };
        loadContext();
    }, [employeeDetails]); 

    // --- Initialization with Initial Data ---
    useEffect(() => {
        if (initialData) {
            if (initialData.requestFor) setRequestFor(initialData.requestFor);
            if (initialData.travelType) setTravelType(initialData.travelType);
            
            if (initialData.travelers && initialData.travelers.length > 0) {
                setTravelers(initialData.travelers);
            }

            if (initialData.trip) setTrip(prev => ({ ...prev, ...initialData.trip }));

            if (initialData.services && initialData.services.length > 0) {
                setServices(initialData.services);
            }
            
            if (initialData.estimatedCost) setEstimatedCost(initialData.estimatedCost);
        }
    }, [initialData]);

    // --- Actions ---

    const handleTripChange = useCallback((field: keyof TripSummary, value: string) => {
        setTrip(prev => ({ ...prev, [field]: value }));
    }, []);

    const handleRequestForChange = useCallback((val: RequestFor) => {
        setRequestFor(val);
        if (val === RequestFor.SELF && employeeDetails) {
            setTravelers([employeeDetails]);
        } else {
            setTravelers([{ 
                id: `NEW-${Date.now()}`, 
                title: 'Mr.',
                name: '', 
                type: val === RequestFor.CLIENT ? 'Guest' : 'Employee',
                jobGrade: 10,
                position: 'Staff'
            }]);
        }
    }, [employeeDetails]);

    // Traveler Management
    const addTraveler = useCallback(() => {
        setTravelers(prev => [...prev, { 
            id: `NEW-${Date.now()}`, 
            title: 'Mr.',
            name: '', 
            type: requestFor === RequestFor.CLIENT ? 'Guest' : 'Employee',
            jobGrade: 10,
            position: 'Staff'
        }]);
    }, [requestFor]);

    const updateTraveler = useCallback((index: number, field: keyof TravelerDetails, value: any) => {
        setTravelers(prev => {
            const updated = [...prev];
            updated[index] = { ...updated[index], [field]: value };
            return updated;
        });
    }, []);

    const removeTraveler = useCallback((index: number) => {
        setTravelers(prev => prev.filter((_, i) => i !== index));
    }, []);

    const selectEmployeeTraveler = useCallback((index: number, empId: string) => {
        const emp = allEmployees.find(e => e.id === empId);
        if (emp) {
            setTravelers(prev => {
                const updated = [...prev];
                updated[index] = {
                    ...updated[index],
                    id: emp.id,
                    name: emp.name,
                    department: emp.department,
                    email: emp.email,
                    type: 'Employee',
                    jobGrade: emp.jobGrade,
                    position: emp.position,
                    mobile: emp.mobile
                };
                return updated;
            });
        }
    }, [allEmployees]);

    // Service Management
    const addService = useCallback((type: ServiceType) => {
        const newService: Partial<TravelServiceItem> = {
            id: `SVC-${Date.now()}`,
            type,
        };

        // Defaults based on Trip
        if (type === 'FLIGHT') {
            Object.assign(newService, {
                tripType: 'ROUND_TRIP',
                from: trip.origin === 'Bangkok' ? 'BKK' : '',
                to: trip.destination || '',
                departureDate: trip.startDate,
                returnDate: trip.endDate,
                flightClass: 'Economy'
            });
        } else if (type === 'HOTEL') {
            Object.assign(newService, {
                location: trip.destination,
                checkIn: trip.startDate,
                checkOut: trip.endDate,
                roomType: 'Standard',
                guests: travelers.length,
                breakfastIncluded: true
            });
        } else if (type === 'CAR') {
             Object.assign(newService, {
                pickupLocation: trip.destination,
                pickupDate: trip.startDate,
                dropoffDate: trip.endDate,
                carType: 'Sedan',
                mileageDistance: 0
            });
        }
        setServices(prev => [...prev, newService as TravelServiceItem]);
    }, [trip, travelers.length]);

    const removeService = useCallback((id: string) => {
        setServices(prev => prev.filter(s => s.id !== id));
    }, []);

    const updateService = useCallback((id: string, field: string, value: any) => {
        setServices(prev => prev.map(s => s.id === id ? { ...s, [field]: value } : s));
    }, []);

    // Helper
    const calculateDays = useCallback(() => {
        if (!trip.startDate || !trip.endDate) return 1;
        const diff = Math.abs(new Date(trip.endDate).getTime() - new Date(trip.startDate).getTime());
        return Math.ceil(diff / (1000 * 60 * 60 * 24)) + 1;
    }, [trip.startDate, trip.endDate]);

    // Submission Construction
    const buildRequestObject = (
        id: string,
        status: RequestStatus = RequestStatus.PENDING_APPROVAL, 
        policyFlags: string[] = []
    ): TravelRequest => {
        const submissionTime = new Date().toISOString();
        const slaDeadline = calculateSLADeadline(submissionTime, travelType);

        return {
            id,
            requesterId: employeeDetails?.id || 'UNKNOWN',
            requesterName: employeeDetails?.name || 'Unknown',
            requestFor,
            travelType,
            travelers,
            trip,
            services,
            status,
            estimatedCost: Number(estimatedCost),
            submittedAt: submissionTime,
            slaDeadline,
            policyFlags
        };
    };

    return {
        requestFor, setRequestFor: handleRequestForChange,
        travelType, setTravelType,
        travelers, addTraveler, updateTraveler, removeTraveler, selectEmployeeTraveler,
        trip, setTrip, handleTripChange,
        services, addService, removeService, updateService,
        estimatedCost, setEstimatedCost,
        calculateDays,
        buildRequestObject,
        currentUser: employeeDetails || EMPTY_USER
    };
};
