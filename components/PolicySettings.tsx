import React, { useState, useEffect, useRef } from 'react';
import { 
    Save, RefreshCw, Shield, Server, Users, Trash2, Check, X, Palette, 
    Database, Lock, FileText, Building, Plus, AlertCircle, Layout, 
    GitMerge, Bell, ToggleLeft, History, GripVertical, Settings, Globe, Briefcase, Wallet, PieChart, ArrowDown, UserCheck
} from 'lucide-react';
import { storageService } from '../services/storage';
import { TravelPolicy, SystemSettings, Agency, TravelerDetails, Project, CostCenter, DOARule, ComplexRule, FormField, WorkflowStep, FeatureToggle, Zone, ExpenseCategory, BudgetRule } from '../types';
import { useTranslation } from '../services/translations';
import { useAuth } from '../contexts/AuthContext';
import { exportService } from '../services/exportService';

// --- CONSTANTS ---
const ALL_COUNTRIES = [
    "Thailand", "Vietnam", "Singapore", "Malaysia", "Indonesia", "Philippines", "Cambodia", "Laos", "Myanmar", "Brunei",
    "Japan", "South Korea", "China", "Hong Kong", "Taiwan", "India", "Australia", "New Zealand",
    "United Kingdom", "France", "Germany", "Italy", "Spain", "Netherlands", "Switzerland", "Sweden", "Norway", "Denmark", "Finland", "Belgium", "Austria", "Portugal",
    "United States", "Canada", "Mexico", "Brazil", "Argentina", "Chile",
    "United Arab Emirates", "Saudi Arabia", "Qatar", "Kuwait", "Oman", "Bahrain", "Israel", "Turkey", 
    "South Africa", "Egypt", "Russia"
].sort();

// --- HELPER COMPONENTS ---

const SettingSection: React.FC<{ title: string; description?: string; children: React.ReactNode; headerAction?: React.ReactNode }> = ({ title, description, children, headerAction }) => (
    <div className="mb-8 border border-slate-200 rounded-xl overflow-hidden bg-white shadow-sm">
        <div className="bg-slate-50 px-6 py-4 border-b border-slate-100 flex justify-between items-center">
            <div>
                <h3 className="text-lg font-bold text-slate-800">{title}</h3>
                {description && <p className="text-sm text-slate-500 mt-1">{description}</p>}
            </div>
            {headerAction}
        </div>
        <div className="p-6">{children}</div>
    </div>
);

const ToggleSwitch: React.FC<{ checked: boolean; onChange: () => void; label?: string }> = ({ checked, onChange, label }) => (
    <div className="flex items-center gap-3">
        {label && <span className="text-sm font-medium text-slate-700">{label}</span>}
        <button 
            onClick={onChange}
            className={`w-10 h-5 rounded-full p-0.5 transition-colors duration-200 ease-in-out ${checked ? 'bg-green-500' : 'bg-slate-300'}`}
        >
            <div className={`bg-white w-4 h-4 rounded-full shadow-md transform duration-200 ${checked ? 'translate-x-5' : 'translate-x-0'}`}></div>
        </button>
    </div>
);

const CountryMultiSelect: React.FC<{ value: string[]; onChange: (val: string[]) => void }> = ({ value, onChange }) => {
    const [search, setSearch] = useState('');
    const [isOpen, setIsOpen] = useState(false);
    const wrapperRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [wrapperRef]);

    const available = ALL_COUNTRIES.filter(c => !value.includes(c) && c.toLowerCase().includes(search.toLowerCase()));

    const addCountry = (country: string) => {
        onChange([...value, country]);
        setSearch('');
    };

    const removeCountry = (country: string) => {
        onChange(value.filter(c => c !== country));
    };

    return (
        <div className="relative w-full" ref={wrapperRef}>
            <div 
                className="flex flex-wrap gap-2 p-2 border border-slate-200 rounded-lg bg-white min-h-[42px] focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500 cursor-text"
                onClick={() => setIsOpen(true)}
            >
                {value.map(c => (
                    <span key={c} className="bg-slate-100 text-slate-700 px-2 py-1 rounded text-xs font-bold flex items-center gap-1 border border-slate-200">
                        {c}
                        <button 
                            onClick={(e) => { e.stopPropagation(); removeCountry(c); }} 
                            className="hover:text-red-500 text-slate-400 transition-colors"
                        >
                            <X size={12}/>
                        </button>
                    </span>
                ))}
                <input 
                    className="flex-1 min-w-[120px] outline-none text-xs md:text-sm bg-transparent"
                    placeholder={value.length === 0 ? "Select countries..." : ""}
                    value={search}
                    onChange={e => { setSearch(e.target.value); setIsOpen(true); }}
                    onFocus={() => setIsOpen(true)}
                />
            </div>
            {isOpen && (
                <div className="absolute top-full left-0 w-full mt-1 bg-white border border-slate-100 rounded-lg shadow-xl z-50 max-h-60 overflow-y-auto animate-fade-in-up">
                    {available.length > 0 ? available.map(c => (
                        <button 
                            key={c} 
                            onClick={() => addCountry(c)}
                            className="w-full text-left px-4 py-2 hover:bg-slate-50 text-sm text-slate-700 hover:text-blue-600 flex items-center justify-between group transition-colors"
                        >
                            {c}
                            <Plus size={14} className="opacity-0 group-hover:opacity-100 text-blue-500"/>
                        </button>
                    )) : (
                        <div className="px-4 py-3 text-xs text-slate-400">No matching countries found.</div>
                    )}
                </div>
            )}
        </div>
    );
};

export const PolicySettings: React.FC = () => {
  const { t } = useTranslation();
  const { userRole } = useAuth();
  
  // Data State
  const [policy, setPolicy] = useState<TravelPolicy | null>(null);
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [agencies, setAgencies] = useState<Agency[]>([]); 
  const [employees, setEmployees] = useState<TravelerDetails[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [costCenters, setCostCenters] = useState<CostCenter[]>([]);
  const [logs, setLogs] = useState<any[]>([]);

  const [isSaved, setIsSaved] = useState(false);
  const [activeTab, setActiveTab] = useState(userRole === 'ADS' ? 'VENDORS' : 'GENERAL');
  const [ruleSubTab, setRuleSubTab] = useState<'GENERAL' | 'FLIGHT' | 'HOTEL' | 'DOA'>('FLIGHT');

  // Load Data
  useEffect(() => {
    const load = async () => {
        setPolicy(await storageService.getPolicies());
        setSettings(storageService.getSettings()); 
        setAgencies(await storageService.getAgencies());
        setEmployees(await storageService.getEmployees());
        setProjects(await storageService.getProjects());
        setCostCenters(await storageService.getCostCenters());
        setLogs(await storageService.getAuditLogs());
    };
    load();
  }, []);

  const handleSave = async () => {
    if (policy && settings) {
      if (userRole === 'ADS') {
          // ADS only has permission to save Agency data
          await storageService.saveAgencies(agencies);
          storageService.addAuditLog('Updated Vendor List', 'VENDORS', 'Updated by ADS');
      } else {
          // Admin saves everything
          await storageService.savePolicies(policy);
          await storageService.saveAgencies(agencies);
          await storageService.saveEmployees(employees);
          await storageService.saveProjects(projects);
          await storageService.saveCostCenters(costCenters);
          storageService.saveSettings(settings);
          storageService.addAuditLog('Saved Settings', 'CONFIG', `Updated ${activeTab}`);
      }
      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 2000);
    }
  };

  // --- CRUD HELPERS ---
  const updateList = <T,>(list: T[], idx: number, updates: Partial<T>, setList: (l: T[]) => void) => {
      const copy = [...list];
      copy[idx] = { ...copy[idx], ...updates };
      setList(copy);
  };
  const removeList = <T,>(list: T[], idx: number, setList: (l: T[]) => void) => {
      const copy = [...list];
      copy.splice(idx, 1);
      setList(copy);
  };
  const addList = <T,>(list: T[], newItem: T, setList: (l: T[]) => void) => {
      setList([...list, newItem]);
  };

  // --- RENDERERS ---

  // 1. FLIGHT MATRIX
  const renderFlightMatrix = () => (
      <div className="overflow-x-auto">
          <table className="w-full text-sm text-left border-collapse">
              <thead className="bg-slate-100 text-slate-500 uppercase text-xs font-bold">
                  <tr>
                      <th className="p-3 border-b">Job Level / Grade</th>
                      <th className="p-3 border-b">Domestic Flight</th>
                      <th className="p-3 border-b">International Flight</th>
                      <th className="p-3 border-b">Min Duration (Hrs)</th>
                      <th className="p-3 border-b">Actions</th>
                  </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                  {policy?.complexRules.filter(r => r.category === 'FLIGHT_CLASS').map((rule, idx) => (
                      <tr key={rule.id} className="hover:bg-slate-50">
                          <td className="p-3">
                              <div className="flex items-center gap-2">
                                  <input type="number" className="w-16 border rounded p-1 text-center font-bold" value={rule.minJobGrade} onChange={(e) => { const newRules = [...policy.complexRules]; const ruleIdx = policy.complexRules.findIndex(r => r.id === rule.id); newRules[ruleIdx].minJobGrade = Number(e.target.value); setPolicy({...policy, complexRules: newRules}); }} />
                                  <span>-</span>
                                  <input type="number" className="w-16 border rounded p-1 text-center font-bold" value={rule.maxJobGrade || 99} onChange={(e) => { const newRules = [...policy.complexRules]; const ruleIdx = policy.complexRules.findIndex(r => r.id === rule.id); newRules[ruleIdx].maxJobGrade = Number(e.target.value); setPolicy({...policy, complexRules: newRules}); }} />
                              </div>
                          </td>
                          <td className="p-3">
                              <select className="border rounded p-1.5 w-full font-medium" value={rule.allowedValue} onChange={(e) => { const newRules = [...policy.complexRules]; const ruleIdx = policy.complexRules.findIndex(r => r.id === rule.id); newRules[ruleIdx].allowedValue = e.target.value; setPolicy({...policy, complexRules: newRules}); }}>
                                  <option>Economy</option><option>Premium Economy</option><option>Business</option><option>First</option>
                              </select>
                          </td>
                          <td className="p-3">
                              <select className="border rounded p-1.5 w-full font-medium" value={rule.allowedValue} onChange={(e) => { const newRules = [...policy.complexRules]; const ruleIdx = policy.complexRules.findIndex(r => r.id === rule.id); newRules[ruleIdx].allowedValue = e.target.value; setPolicy({...policy, complexRules: newRules}); }}>
                                  <option>Economy</option><option>Premium Economy</option><option>Business</option><option>First</option>
                              </select>
                          </td>
                          <td className="p-3">
                              <input type="number" className="w-16 border rounded p-1 text-center" value={rule.minDurationHours || 0} onChange={(e) => { const newRules = [...policy.complexRules]; const ruleIdx = policy.complexRules.findIndex(r => r.id === rule.id); newRules[ruleIdx].minDurationHours = Number(e.target.value); setPolicy({...policy, complexRules: newRules}); }} />
                          </td>
                          <td className="p-3">
                              <button onClick={() => setPolicy({...policy, complexRules: policy.complexRules.filter(r => r.id !== rule.id)})} className="text-red-500 hover:bg-red-50 p-1 rounded"><Trash2 size={16}/></button>
                          </td>
                      </tr>
                  ))}
              </tbody>
          </table>
          <button onClick={() => setPolicy({...policy!, complexRules: [...policy!.complexRules, { id: `R-${Date.now()}`, companyId: 'ALL', category: 'FLIGHT_CLASS', minJobGrade: 0, maxJobGrade: 10, travelType: 'ALL', allowedValue: 'Economy' }]})} className="mt-4 text-sm font-bold text-blue-600 flex items-center gap-2 hover:underline"><Plus size={16}/> Add Grade Level</button>
      </div>
  );

  // 4. BUDGET CONTROL
  const renderBudgetControl = () => (
      <SettingSection title="Budget Control" description="Set spending limits per department or project.">
          <div className="space-y-4">
              {policy?.budgetRules.map((budget, idx) => (
                  <div key={budget.id} className="p-4 border rounded-xl bg-white shadow-sm flex flex-col gap-3">
                      <div className="flex justify-between items-start">
                          <div className="flex gap-4 items-center">
                              <div className={`p-2 rounded-lg ${budget.scope === 'DEPARTMENT' ? 'bg-blue-100 text-blue-600' : 'bg-purple-100 text-purple-600'}`}>
                                  {budget.scope === 'DEPARTMENT' ? <Building size={20}/> : <Briefcase size={20}/>}
                              </div>
                              <div>
                                  <div className="font-bold text-slate-800">{budget.targetId}</div>
                                  <div className="text-xs text-slate-500">{budget.scope} • {budget.period}</div>
                              </div>
                          </div>
                          <div className="text-right">
                              <div className="text-2xl font-bold text-slate-900">{budget.spent.toLocaleString()} / {budget.amount.toLocaleString()}</div>
                              <div className="text-xs font-bold text-slate-400">THB Used</div>
                          </div>
                      </div>
                      <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div className={`h-full ${budget.spent/budget.amount > (budget.alertThreshold/100) ? 'bg-red-500' : 'bg-green-500'}`} style={{ width: `${Math.min(100, (budget.spent / budget.amount) * 100)}%` }}></div>
                      </div>
                      <div className="flex justify-between text-xs text-slate-500">
                          <span>Alert at {budget.alertThreshold}%</span>
                          <button className="text-blue-600 hover:underline">Edit Limit</button>
                      </div>
                  </div>
              ))}
              <button onClick={() => setPolicy({...policy!, budgetRules: [...policy!.budgetRules, { id: `B-${Date.now()}`, scope: 'DEPARTMENT', targetId: 'NEW', amount: 100000, spent: 0, period: 'YEARLY', alertThreshold: 80 }]})} className="w-full py-3 border-2 border-dashed border-slate-300 rounded-xl text-slate-400 font-bold hover:text-blue-500 hover:border-blue-400 flex items-center justify-center gap-2"><Plus size={16}/> Add Budget Rule</button>
          </div>
      </SettingSection>
  );

  // 6. MASTER DATA RENDERER
  const renderMasterData = () => (
    <SettingSection title="Master Data Management" description="Manage Employees, Projects, and Cost Centers.">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* EMPLOYEES */}
            <div className="p-4 border rounded-xl bg-slate-50 flex flex-col h-96">
                <div className="flex justify-between items-center mb-3">
                    <h4 className="font-bold text-slate-700 flex items-center gap-2"><Users size={16}/> Employees ({employees.length})</h4>
                    <button onClick={() => addList(employees, { id: `EMP${Date.now()}`, name: 'New Employee', email: '', department: 'General', type: 'Employee', title: 'Mr.', position: 'Staff', jobGrade: 10 }, setEmployees)} className="text-xs bg-white border border-slate-300 px-2 py-1 rounded hover:bg-slate-100 flex items-center gap-1"><Plus size={12}/> Add</button>
                </div>
                <div className="overflow-y-auto space-y-2 pr-2 flex-1">
                    {employees.map((emp, idx) => (
                        <div key={emp.id} className="bg-white p-2 rounded border border-slate-200 text-xs flex gap-2 items-center group">
                            <div className="flex-1 grid grid-cols-2 gap-1">
                                <input className="font-bold border-b border-transparent focus:border-blue-500 outline-none" value={emp.name} onChange={e => updateList(employees, idx, {name: e.target.value}, setEmployees)} placeholder="Name"/>
                                <input className="text-slate-500 border-b border-transparent focus:border-blue-500 outline-none" value={emp.email} onChange={e => updateList(employees, idx, {email: e.target.value}, setEmployees)} placeholder="Email"/>
                                <input className="text-slate-500 border-b border-transparent focus:border-blue-500 outline-none" value={emp.department} onChange={e => updateList(employees, idx, {department: e.target.value}, setEmployees)} placeholder="Dept"/>
                                <input className="text-slate-500 border-b border-transparent focus:border-blue-500 outline-none" value={emp.position} onChange={e => updateList(employees, idx, {position: e.target.value as any}, setEmployees)} placeholder="Position"/>
                            </div>
                            <button onClick={() => removeList(employees, idx, setEmployees)} className="text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100"><Trash2 size={14}/></button>
                        </div>
                    ))}
                </div>
            </div>

            {/* PROJECTS */}
             <div className="p-4 border rounded-xl bg-slate-50 flex flex-col h-96">
                <div className="flex justify-between items-center mb-3">
                    <h4 className="font-bold text-slate-700 flex items-center gap-2"><Briefcase size={16}/> Projects ({projects.length})</h4>
                    <button onClick={() => addList(projects, { code: `PRJ-${Date.now()}`, name: 'New Project', manager: 'Manager', budget: 0, spent: 0, status: 'Active' as const }, setProjects)} className="text-xs bg-white border border-slate-300 px-2 py-1 rounded hover:bg-slate-100 flex items-center gap-1"><Plus size={12}/> Add</button>
                </div>
                <div className="overflow-y-auto space-y-2 pr-2 flex-1">
                    {projects.map((proj, idx) => (
                        <div key={proj.code} className="bg-white p-2 rounded border border-slate-200 text-xs flex gap-2 items-center group">
                            <div className="flex-1">
                                <div className="flex justify-between">
                                    <input className="font-bold border-b border-transparent focus:border-blue-500 outline-none w-2/3" value={proj.name} onChange={e => updateList(projects, idx, {name: e.target.value}, setProjects)}/>
                                    <input className="font-mono text-slate-500 border-b border-transparent focus:border-blue-500 outline-none w-1/4 text-right" value={proj.code} onChange={e => updateList(projects, idx, {code: e.target.value}, setProjects)}/>
                                </div>
                                <div className="flex justify-between mt-1">
                                    <input className="text-slate-500 border-b border-transparent focus:border-blue-500 outline-none w-1/2" value={proj.manager} onChange={e => updateList(projects, idx, {manager: e.target.value}, setProjects)}/>
                                    <select className="text-green-600 border-none bg-transparent text-[10px]" value={proj.status} onChange={e => updateList(projects, idx, {status: e.target.value as any}, setProjects)}>
                                        <option>Active</option><option>Closed</option>
                                    </select>
                                </div>
                            </div>
                            <button onClick={() => removeList(projects, idx, setProjects)} className="text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100"><Trash2 size={14}/></button>
                        </div>
                    ))}
                </div>
            </div>

            {/* COST CENTERS */}
             <div className="p-4 border rounded-xl bg-slate-50 md:col-span-2">
                <div className="flex justify-between items-center mb-3">
                    <h4 className="font-bold text-slate-700 flex items-center gap-2"><Building size={16}/> Cost Centers ({costCenters.length})</h4>
                    <button onClick={() => addList(costCenters, { code: `CC-${Date.now()}`, name: 'New Cost Center', department: 'General', budget: 0, available: 0 }, setCostCenters)} className="text-xs bg-white border border-slate-300 px-2 py-1 rounded hover:bg-slate-100 flex items-center gap-1"><Plus size={12}/> Add</button>
                </div>
                 <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {costCenters.map((cc, idx) => (
                        <div key={cc.code} className="bg-white p-3 rounded border border-slate-200 text-xs relative group">
                            <button onClick={() => removeList(costCenters, idx, setCostCenters)} className="absolute top-2 right-2 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100"><Trash2 size={14}/></button>
                            <input className="font-bold text-slate-800 w-full border-b border-transparent focus:border-blue-500 outline-none mb-1" value={cc.name} onChange={e => updateList(costCenters, idx, {name: e.target.value}, setCostCenters)} />
                            <input className="font-mono text-slate-500 w-full border-b border-transparent focus:border-blue-500 outline-none mb-1" value={cc.code} onChange={e => updateList(costCenters, idx, {code: e.target.value}, setCostCenters)} />
                            <div className="flex items-center gap-1 text-slate-400">
                                <span>Budget:</span>
                                <input type="number" className="w-20 border-b border-transparent focus:border-blue-500 outline-none" value={cc.budget} onChange={e => updateList(costCenters, idx, {budget: Number(e.target.value)}, setCostCenters)}/>
                            </div>
                        </div>
                    ))}
                 </div>
            </div>
        </div>
    </SettingSection>
  );

  // 7. FORM BUILDER RENDERER
  const renderFormBuilder = () => (
    <SettingSection title="Dynamic Request Form" description="Customize fields appearing on the New Request form.">
        <div className="space-y-3">
            <div className="flex text-xs font-bold text-slate-400 uppercase px-3">
                <div className="w-8">Ord</div>
                <div className="w-1/3">Label</div>
                <div className="w-24">Type</div>
                <div className="w-20 text-center">Required</div>
                <div className="w-20 text-center">Active</div>
            </div>
            {settings?.dynamicForms?.map((field, idx) => (
                <div key={field.id} className="flex items-center gap-3 p-3 bg-white border border-slate-200 rounded-lg shadow-sm group">
                     <div className="w-8 flex justify-center cursor-move text-slate-300 hover:text-slate-500"><GripVertical size={16}/></div>
                     <input 
                        className="w-1/3 border-b border-transparent focus:border-blue-500 outline-none font-bold text-slate-700 bg-transparent"
                        value={field.label}
                        onChange={(e) => {
                             const newForms = [...(settings.dynamicForms || [])];
                             newForms[idx].label = e.target.value;
                             setSettings({...settings, dynamicForms: newForms});
                        }}
                     />
                     <select 
                        className="w-24 text-xs bg-slate-50 border border-slate-200 rounded p-1"
                        value={field.type}
                        onChange={(e) => {
                             const newForms = [...(settings.dynamicForms || [])];
                             newForms[idx].type = e.target.value as any;
                             setSettings({...settings, dynamicForms: newForms});
                        }}
                     >
                         <option value="text">Text</option>
                         <option value="number">Number</option>
                         <option value="date">Date</option>
                         <option value="dropdown">Dropdown</option>
                         <option value="checkbox">Checkbox</option>
                     </select>
                     
                     <div className="w-20 flex justify-center">
                         <input 
                            type="checkbox" 
                            checked={field.required}
                            onChange={(e) => {
                                 const newForms = [...(settings.dynamicForms || [])];
                                 newForms[idx].required = e.target.checked;
                                 setSettings({...settings, dynamicForms: newForms});
                            }}
                         />
                     </div>
                     <div className="w-20 flex justify-center">
                         <ToggleSwitch 
                            checked={field.active} 
                            onChange={() => {
                                 const newForms = [...(settings.dynamicForms || [])];
                                 newForms[idx].active = !field.active;
                                 setSettings({...settings, dynamicForms: newForms});
                            }}
                         />
                     </div>
                     
                     <button 
                        onClick={() => {
                            const newForms = [...(settings.dynamicForms || [])];
                            newForms.splice(idx, 1);
                            setSettings({...settings, dynamicForms: newForms});
                        }}
                        className="text-slate-300 hover:text-red-500 ml-auto"
                     >
                         <Trash2 size={16}/>
                     </button>
                </div>
            ))}
            <button 
                onClick={() => setSettings({...settings!, dynamicForms: [...(settings!.dynamicForms || []), { id: `f${Date.now()}`, label: 'New Field', type: 'text', required: false, order: (settings?.dynamicForms?.length || 0) + 1, active: true }]})}
                className="w-full py-3 border-2 border-dashed border-slate-300 rounded-xl text-slate-400 font-bold hover:text-blue-500 hover:border-blue-400 flex items-center justify-center gap-2 transition-colors"
            >
                <Plus size={16}/> Add Custom Field
            </button>
        </div>
    </SettingSection>
  );

  // 8. WORKFLOW VISUALIZER / EDITOR
  const renderWorkflowEditor = () => (
      <SettingSection title="Workflow & Approval Chain" description="Define approval steps and logic.">
          <div className="relative pl-8 border-l-2 border-slate-200 space-y-8">
              {settings?.workflows?.map((step, idx) => (
                  <div key={step.id} className="relative bg-white border border-slate-200 p-4 rounded-xl shadow-sm">
                      {/* Connector Dot */}
                      <div className="absolute -left-[41px] top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-blue-500 border-4 border-slate-50 flex items-center justify-center text-white text-[10px] font-bold">
                          {idx + 1}
                      </div>
                      
                      <div className="flex justify-between items-start mb-4">
                          <div>
                              <input 
                                  className="font-bold text-slate-800 text-lg border-b border-transparent focus:border-blue-500 outline-none" 
                                  value={step.name}
                                  onChange={(e) => {
                                      const newWf = [...(settings.workflows || [])];
                                      newWf[idx].name = e.target.value;
                                      setSettings({...settings, workflows: newWf});
                                  }}
                              />
                              <div className="text-xs text-slate-500 mt-1 flex items-center gap-2">
                                  <UserCheck size={12}/> Approver: 
                                  <select 
                                      className="bg-slate-50 border border-slate-200 rounded px-2 py-0.5"
                                      value={step.approverRole}
                                      onChange={(e) => {
                                          const newWf = [...(settings.workflows || [])];
                                          newWf[idx].approverRole = e.target.value as any;
                                          setSettings({...settings, workflows: newWf});
                                      }}
                                  >
                                      <option value="LineManager">Line Manager</option>
                                      <option value="DepartmentHead">Department Head</option>
                                      <option value="CFO">CFO</option>
                                      <option value="President">President</option>
                                      <option value="HR">HR</option>
                                  </select>
                              </div>
                          </div>
                          <button 
                              onClick={() => {
                                  const newWf = [...(settings.workflows || [])];
                                  newWf.splice(idx, 1);
                                  setSettings({...settings, workflows: newWf});
                              }}
                              className="text-slate-300 hover:text-red-500"
                          >
                              <Trash2 size={16}/>
                          </button>
                      </div>

                      <div className="bg-slate-50 p-3 rounded-lg text-xs grid grid-cols-2 gap-4">
                          <div>
                              <label className="font-bold text-slate-500 block mb-1">Condition (Optional)</label>
                              <div className="flex gap-2">
                                  <select className="border rounded p-1 w-20">
                                      <option>Cost</option>
                                      <option>Type</option>
                                  </select>
                                  <select className="border rounded p-1 w-12">
                                      <option>{'>'}</option>
                                      <option>{'='}</option>
                                  </select>
                                  <input 
                                      type="number" 
                                      className="border rounded p-1 w-20"
                                      value={step.condition?.value || ''}
                                      placeholder="Value"
                                      onChange={(e) => {
                                          const newWf = [...(settings.workflows || [])];
                                          newWf[idx].condition = { field: 'totalCost', operator: '>', value: Number(e.target.value) };
                                          setSettings({...settings, workflows: newWf});
                                      }}
                                  />
                              </div>
                          </div>
                          <div>
                              <label className="font-bold text-slate-500 block mb-1">SLA Deadline (Hours)</label>
                              <input 
                                  type="number" 
                                  className="border rounded p-1 w-20"
                                  value={step.slaHours}
                                  onChange={(e) => {
                                      const newWf = [...(settings.workflows || [])];
                                      newWf[idx].slaHours = Number(e.target.value);
                                      setSettings({...settings, workflows: newWf});
                                  }}
                              />
                          </div>
                      </div>
                  </div>
              ))}
              <button 
                  onClick={() => setSettings({...settings!, workflows: [...(settings!.workflows || []), { id: `w${Date.now()}`, name: 'New Step', approverRole: 'LineManager', slaHours: 24 }]})}
                  className="absolute left-[-16px] bottom-[-20px] w-8 h-8 bg-white border-2 border-slate-300 rounded-full flex items-center justify-center text-slate-400 hover:text-blue-500 hover:border-blue-500 transition-colors shadow-sm"
              >
                  <Plus size={16}/>
              </button>
          </div>
          <div className="h-8"></div> {/* Spacer for the add button */}
      </SettingSection>
  );

  const MENU_ITEMS = [
      { id: 'RULES', icon: Shield, label: 'Policy Rules' },
      { id: 'ZONES', icon: Globe, label: 'Destinations & Zones' },
      { id: 'EXPENSES', icon: Wallet, label: 'Expenses & Allowance' },
      { id: 'BUDGET', icon: PieChart, label: 'Budget Control' },
      { id: 'WORKFLOW', icon: GitMerge, label: 'Workflow & Approval' },
      { id: 'FORM', icon: Layout, label: 'Form Builder' },
      { id: 'GENERAL', icon: Settings, label: 'System & Branding' },
      { id: 'MASTER', icon: Database, label: 'Master Data' },
      { id: 'AUDIT', icon: History, label: 'Audit Logs' },
      { id: 'VENDORS', icon: Users, label: 'Vendors' },
  ];

  if (!['IT_ADMIN', 'ADS'].includes(userRole)) {
      return (
          <div className="p-10 text-center text-slate-500">
              <Lock size={48} className="mx-auto mb-4 text-slate-300"/>
              <h2 className="text-xl font-bold text-slate-700">Access Denied</h2>
              <p>You do not have permission to view this page.</p>
          </div>
      );
  }

  if (!policy || !settings) return <div>Loading...</div>;

  return (
    <div className="flex h-[calc(100vh-64px)] bg-[#f8fafc]">
        {/* SIDEBAR NAVIGATION */}
        <div className="w-64 bg-white border-r border-slate-200 flex flex-col">
            <div className="p-5 border-b border-slate-100">
                <h2 className="font-bold text-slate-800">Admin Console</h2>
                <p className="text-xs text-slate-500 mt-1">Enterprise Policy v2.1</p>
            </div>
            <nav className="flex-1 overflow-y-auto p-3 space-y-1">
                {MENU_ITEMS.filter(m => userRole === 'IT_ADMIN' || m.id === 'VENDORS').map(item => (
                    <button
                        key={item.id}
                        onClick={() => setActiveTab(item.id)}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors
                        ${activeTab === item.id ? 'bg-slate-900 text-white shadow-md' : 'text-slate-600 hover:bg-slate-100'}`}
                    >
                        <item.icon size={18}/>
                        {item.label}
                    </button>
                ))}
            </nav>
            <div className="p-4 border-t border-slate-100">
                <button 
                    onClick={handleSave}
                    className={`w-full py-2.5 rounded-xl font-bold text-white flex items-center justify-center gap-2 shadow-lg transition-all
                    ${isSaved ? 'bg-green-600 hover:bg-green-700' : 'bg-blue-600 hover:bg-blue-700'}`}
                >
                    {isSaved ? <Check size={18}/> : <Save size={18}/>}
                    {isSaved ? 'Saved' : 'Save Changes'}
                </button>
            </div>
        </div>

        {/* MAIN CONTENT AREA */}
        <div className="flex-1 overflow-y-auto p-8">
            <div className="max-w-5xl mx-auto animate-fade-in">
                
                {activeTab === 'RULES' && (
                    <>
                        <div className="flex gap-4 mb-6">
                            {['FLIGHT', 'HOTEL', 'DOA'].map((sub) => (
                                <button 
                                    key={sub}
                                    onClick={() => setRuleSubTab(sub as any)}
                                    className={`px-4 py-2 rounded-lg font-bold text-sm ${ruleSubTab === sub ? 'bg-white shadow text-blue-600 ring-1 ring-slate-200' : 'text-slate-500 hover:bg-slate-100'}`}
                                >
                                    {sub === 'FLIGHT' ? 'Flight Matrix' : sub === 'HOTEL' ? 'Hotel Limits' : 'Approval Chain'}
                                </button>
                            ))}
                        </div>
                        
                        {ruleSubTab === 'FLIGHT' && (
                            <SettingSection title="Flight Class Policy" description="Define allowed cabin class by job grade.">
                                {renderFlightMatrix()}
                            </SettingSection>
                        )}
                        {ruleSubTab === 'DOA' && (
                            <SettingSection title="Approval Workflow (DOA)" description="Define approvers based on cost thresholds.">
                                <div className="text-slate-500 italic p-4 text-center border-2 border-dashed rounded-lg">Configure detailed approval limits in the matrix table...</div>
                            </SettingSection>
                        )}
                        {ruleSubTab === 'HOTEL' && (
                            <div className="text-slate-500 italic p-10 text-center">Hotel Matrix Configuration...</div>
                        )}
                    </>
                )}

                {activeTab === 'ZONES' && (
                    <SettingSection title="Destination Zones & Per Diem" description="Define country groups and daily allowances." headerAction={
                        <button onClick={() => addList(policy!.zones, { id: `Z-${Date.now()}`, name: 'New Zone', countries: [], currency: 'USD', perDiem: 50 }, (z) => setPolicy({...policy!, zones: z}))} className="bg-slate-900 text-white px-3 py-1.5 rounded text-xs font-bold flex items-center gap-1"><Plus size={14}/> Add Zone</button>
                    }>
                        <div className="grid grid-cols-1 gap-4">
                            {policy?.zones.map((zone, idx) => (
                                <div key={zone.id} className="border rounded-xl p-4 bg-slate-50 relative group">
                                    <button onClick={() => removeList(policy.zones, idx, (z) => setPolicy({...policy, zones: z}))} className="absolute top-2 right-2 text-slate-400 hover:text-red-500"><Trash2 size={16}/></button>
                                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-start">
                                        <div className="col-span-1">
                                            <label className="text-[10px] font-bold text-slate-500 uppercase">Zone Name</label>
                                            <input className="w-full border rounded p-2 mt-1 font-bold text-slate-800" value={zone.name} onChange={e => updateList(policy.zones, idx, {name: e.target.value}, (z) => setPolicy({...policy, zones: z}))} />
                                        </div>
                                        <div className="col-span-2">
                                            <label className="text-[10px] font-bold text-slate-500 uppercase">Countries</label>
                                            {/* REPLACED TEXTAREA WITH MULTI-SELECT */}
                                            <CountryMultiSelect 
                                                value={zone.countries}
                                                onChange={(newCountries) => updateList(policy.zones, idx, {countries: newCountries}, (z) => setPolicy({...policy, zones: z}))}
                                            />
                                        </div>
                                        <div className="col-span-1 flex gap-2">
                                            <div className="flex-1">
                                                <label className="text-[10px] font-bold text-slate-500 uppercase">Per Diem</label>
                                                <input type="number" className="w-full border rounded p-2 mt-1 font-bold text-green-700" value={zone.perDiem} onChange={e => updateList(policy.zones, idx, {perDiem: Number(e.target.value)}, (z) => setPolicy({...policy, zones: z}))} />
                                            </div>
                                            <div className="w-20">
                                                <label className="text-[10px] font-bold text-slate-500 uppercase">Curr</label>
                                                <input className="w-full border rounded p-2 mt-1 text-center" value={zone.currency} onChange={e => updateList(policy.zones, idx, {currency: e.target.value}, (z) => setPolicy({...policy, zones: z}))} />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </SettingSection>
                )}
                
                {activeTab === 'EXPENSES' && (
                    <SettingSection title="Expense Categories" description="Configure allowable expense types and limits." headerAction={
                        <button onClick={() => addList(policy!.expenseCategories, { id: `E-${Date.now()}`, name: 'New Expense', requiresReceipt: true, allowCashAdvance: false, active: true }, (e) => setPolicy({...policy!, expenseCategories: e}))} className="bg-slate-900 text-white px-3 py-1.5 rounded text-xs font-bold flex items-center gap-1"><Plus size={14}/> Add Category</button>
                    }>
                        <div className="space-y-2">
                            {policy?.expenseCategories.map((exp, idx) => (
                                <div key={exp.id} className="flex items-center gap-4 p-3 border rounded-lg bg-white">
                                    <input type="checkbox" checked={exp.active} onChange={e => updateList(policy.expenseCategories, idx, {active: e.target.checked}, (ex) => setPolicy({...policy, expenseCategories: ex}))} />
                                    <div className="flex-1 grid grid-cols-4 gap-4">
                                        <input className="border-b border-transparent hover:border-slate-300 focus:border-blue-500 outline-none font-medium" value={exp.name} onChange={e => updateList(policy.expenseCategories, idx, {name: e.target.value}, (ex) => setPolicy({...policy, expenseCategories: ex}))} />
                                        
                                        <label className="flex items-center gap-2 text-xs cursor-pointer">
                                            <input type="checkbox" checked={exp.requiresReceipt} onChange={e => updateList(policy.expenseCategories, idx, {requiresReceipt: e.target.checked}, (ex) => setPolicy({...policy, expenseCategories: ex}))} />
                                            Receipt Required
                                        </label>
                                        <label className="flex items-center gap-2 text-xs cursor-pointer">
                                            <input type="checkbox" checked={exp.allowCashAdvance} onChange={e => updateList(policy.expenseCategories, idx, {allowCashAdvance: e.target.checked}, (ex) => setPolicy({...policy, expenseCategories: ex}))} />
                                            Allow Cash Advance
                                        </label>
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs text-slate-500">Limit:</span>
                                            <input type="number" placeholder="No Limit" className="border rounded p-1 w-24 text-xs" value={exp.dailyLimit || ''} onChange={e => updateList(policy.expenseCategories, idx, {dailyLimit: Number(e.target.value)}, (ex) => setPolicy({...policy, expenseCategories: ex}))} />
                                        </div>
                                    </div>
                                    <button onClick={() => removeList(policy.expenseCategories, idx, (ex) => setPolicy({...policy, expenseCategories: ex}))} className="text-slate-400 hover:text-red-500"><Trash2 size={16}/></button>
                                </div>
                            ))}
                        </div>
                    </SettingSection>
                )}
                
                {activeTab === 'BUDGET' && renderBudgetControl()}
                
                {activeTab === 'AUDIT' && (
                    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-slate-50 border-b border-slate-100 text-slate-500 uppercase text-xs">
                                <tr>
                                    <th className="p-4">Timestamp</th>
                                    <th className="p-4">User</th>
                                    <th className="p-4">Action</th>
                                    <th className="p-4">Module</th>
                                    <th className="p-4">Details</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {logs.map((log, idx) => (
                                    <tr key={idx} className="hover:bg-slate-50/50">
                                        <td className="p-4 font-mono text-xs text-slate-500">{new Date(log.timestamp).toLocaleString()}</td>
                                        <td className="p-4 font-bold text-slate-700">{log.user}</td>
                                        <td className="p-4 text-slate-800">{log.action}</td>
                                        <td className="p-4"><span className="px-2 py-1 bg-slate-100 rounded text-xs font-bold text-slate-600">{log.module}</span></td>
                                        <td className="p-4 text-slate-500 truncate max-w-xs">{log.details}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* --- LEGACY TABS (Kept functional) --- */}
                {activeTab === 'GENERAL' && (
                    <SettingSection title="System Parameters" description="Global constants and format settings.">
                        <div className="grid grid-cols-2 gap-6">
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-1">Tax Rate (%)</label>
                                <select 
                                    className="w-full border rounded-lg p-2" 
                                    value={settings?.systemParams?.taxRate} 
                                    onChange={e => setSettings({...settings!, systemParams: {...settings!.systemParams!, taxRate: Number(e.target.value)}})}
                                >
                                    <option value="0">0% (Tax Exempt)</option>
                                    <option value="7">7% (VAT)</option>
                                    <option value="10">10%</option>
                                    <option value="15">15%</option>
                                    <option value="20">20%</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-1">Currency</label>
                                <select 
                                    className="w-full border rounded-lg p-2" 
                                    value={settings?.systemParams?.currency} 
                                    onChange={e => setSettings({...settings!, systemParams: {...settings!.systemParams!, currency: e.target.value}})}
                                >
                                    <option value="THB">THB (Thai Baht)</option>
                                    <option value="USD">USD (US Dollar)</option>
                                    <option value="EUR">EUR (Euro)</option>
                                    <option value="JPY">JPY (Japanese Yen)</option>
                                    <option value="SGD">SGD (Singapore Dollar)</option>
                                    <option value="CNY">CNY (Chinese Yuan)</option>
                                </select>
                            </div>
                        </div>
                    </SettingSection>
                )}

                {activeTab === 'MASTER' && renderMasterData()}
                
                {activeTab === 'FORM' && renderFormBuilder()}
                
                {activeTab === 'WORKFLOW' && renderWorkflowEditor()}

                {activeTab === 'VENDORS' && (
                    <SettingSection title="Agency Vendors" description="Manage approved travel agencies.">
                        <div className="space-y-4">
                            {agencies.map((agency, idx) => (
                                <div key={agency.id} className="p-4 border rounded-xl bg-slate-50 flex gap-4 items-center group">
                                    <div className="flex-1 grid grid-cols-2 gap-3">
                                        <input 
                                            className="font-bold border-b border-transparent focus:border-blue-500 outline-none bg-transparent" 
                                            value={agency.name} 
                                            onChange={(e) => updateList(agencies, idx, {name: e.target.value}, setAgencies)}
                                        />
                                        <input 
                                            className="text-slate-500 text-sm border-b border-transparent focus:border-blue-500 outline-none bg-transparent" 
                                            value={agency.email} 
                                            onChange={(e) => updateList(agencies, idx, {email: e.target.value}, setAgencies)}
                                        />
                                        <select 
                                            className="text-xs bg-white border border-slate-200 rounded p-1 w-full"
                                            value={agency.type}
                                            onChange={(e) => updateList(agencies, idx, {type: e.target.value as any}, setAgencies)}
                                        >
                                            <option>Full Service</option>
                                            <option>Low Cost</option>
                                            <option>Hotel Specialist</option>
                                            <option>Car Rental</option>
                                        </select>
                                        <div className="flex items-center gap-2">
                                            <input 
                                                type="checkbox" 
                                                checked={agency.isPreferred} 
                                                onChange={(e) => updateList(agencies, idx, {isPreferred: e.target.checked}, setAgencies)}
                                            />
                                            <span className="text-xs text-slate-500">Preferred</span>
                                        </div>
                                    </div>
                                    <button onClick={() => removeList(agencies, idx, setAgencies)} className="text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100"><Trash2 size={16}/></button>
                                </div>
                            ))}
                            <button 
                                onClick={() => addList(agencies, {id: `AG-${Date.now()}`, name: 'New Agency', email: 'contact@agency.com', type: 'Full Service', isPreferred: false}, setAgencies)} 
                                className="w-full py-2 border-2 border-dashed border-slate-300 rounded-xl text-slate-400 font-bold hover:border-blue-400 hover:text-blue-500 flex items-center justify-center gap-2"
                            >
                                <Plus size={16}/> Add Vendor
                            </button>
                        </div>
                    </SettingSection>
                )}
            </div>
        </div>
    </div>
  );
};