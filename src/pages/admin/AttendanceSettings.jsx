import { useState, useEffect } from 'react';
import { adminAPI } from '../../api/services';
import {
  Clock, Save, Loader, Info, Calendar, Pencil, X, Check
} from 'lucide-react';
import toast from 'react-hot-toast';
import { format, parseISO } from 'date-fns';

const ALL_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const DAY_SHORT = { Monday:'Mon', Tuesday:'Tue', Wednesday:'Wed', Thursday:'Thu', Friday:'Fri', Saturday:'Sat', Sunday:'Sun' };

// Format a date string (ISO or raw DB) to "dd MMM yyyy"
function fmtDate(str) {
  if (!str) return '—';
  try { return format(parseISO(str.split('T')[0]), 'dd MMM yyyy'); }
  catch { return str; }
}

// Summarise days array to a human-readable string
function summariseDays(days) {
  if (!days || days.length === 0) return 'None';
  if (days.length === 5 && ['Monday','Tuesday','Wednesday','Thursday','Friday'].every(d => days.includes(d)) && !days.includes('Saturday') && !days.includes('Sunday')) return 'Mon – Fri';
  if (days.length === 6 && !days.includes('Sunday')) return 'Mon – Sat';
  if (days.length === 7) return 'All Days';
  return days.map(d => DAY_SHORT[d] || d).join(', ');
}

export default function AttendanceSettings() {
  // ── Session Settings ──────────────────────────────────────────────
  const [sessions, setSessions]   = useState([]);
  const [loadingSess, setLoadSess] = useState(true);
  const [savingSess, setSavSess]  = useState(false);

  // ── Academic Calendar ─────────────────────────────────────────────
  const [wd, setWd]           = useState(null);   // loaded data
  const [loadingWd, setLoadWd] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [savingWd, setSavWd]  = useState(false);

  // Editable form state
  const [wdForm, setWdForm] = useState({
    academic_year: '',
    semester_label: '',
    semester_start: '',
    semester_end: '',
    working_days_json: [],
  });

  // ── Load both on mount ────────────────────────────────────────────
  useEffect(() => {
    adminAPI.getAttendanceSettings()
      .then(({ data }) => setSessions(data.data || []))
      .finally(() => setLoadSess(false));

    adminAPI.getWorkingDays()
      .then(({ data }) => {
        const d = data.data;
        setWd(d);
        if (d) {
          setWdForm({
            academic_year:    d.academic_year    || '',
            semester_label:   d.semester_label   || '',
            semester_start:   d.semester_start   ? d.semester_start.split('T')[0] : '',
            semester_end:     d.semester_end     ? d.semester_end.split('T')[0]   : '',
            working_days_json: Array.isArray(d.working_days_json)
              ? d.working_days_json
              : (typeof d.working_days_json === 'string' ? JSON.parse(d.working_days_json || '[]') : []),
          });
        }
      })
      .finally(() => setLoadWd(false));
  }, []);

  // ── Session helpers ───────────────────────────────────────────────
  const updateSession = (index, key, value) => {
    setSessions(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [key]: value };
      return updated;
    });
  };

  const handleSaveSessions = async () => {
    setSavSess(true);
    try {
      await adminAPI.updateAttendanceSettings({ sessions });
      toast.success('Attendance settings saved successfully.');
    } catch {
      toast.error('Failed to save attendance settings.');
    } finally {
      setSavSess(false);
    }
  };

  // ── Calendar edit helpers ─────────────────────────────────────────
  const toggleDay = (day) => {
    setWdForm(prev => {
      const days = prev.working_days_json.includes(day)
        ? prev.working_days_json.filter(d => d !== day)
        : [...prev.working_days_json, day];
      // Keep in week order
      return { ...prev, working_days_json: ALL_DAYS.filter(d => days.includes(d)) };
    });
  };

  const cancelEdit = () => {
    // Reset form back to loaded data
    if (wd) {
      setWdForm({
        academic_year:    wd.academic_year    || '',
        semester_label:   wd.semester_label   || '',
        semester_start:   wd.semester_start   ? wd.semester_start.split('T')[0] : '',
        semester_end:     wd.semester_end     ? wd.semester_end.split('T')[0]   : '',
        working_days_json: Array.isArray(wd.working_days_json)
          ? wd.working_days_json
          : (typeof wd.working_days_json === 'string' ? JSON.parse(wd.working_days_json || '[]') : []),
      });
    }
    setEditMode(false);
  };

  const handleSaveCalendar = async () => {
    if (!wdForm.academic_year.trim()) { toast.error('Academic Year is required.'); return; }
    if (!wdForm.semester_start)        { toast.error('Semester Start date is required.'); return; }
    if (!wdForm.semester_end)          { toast.error('Semester End date is required.'); return; }
    if (wdForm.working_days_json.length === 0) { toast.error('Select at least one working day.'); return; }
    if (wdForm.semester_end <= wdForm.semester_start) { toast.error('Semester End must be after Semester Start.'); return; }

    setSavWd(true);
    try {
      await adminAPI.updateWorkingDays(wdForm);
      setWd({ ...wd, ...wdForm });
      toast.success('Academic calendar saved successfully.');
      setEditMode(false);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save academic calendar.');
    } finally {
      setSavWd(false);
    }
  };

  // ── Loading skeleton ──────────────────────────────────────────────
  if (loadingSess && loadingWd) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="skeleton h-8 w-48" />
        <div className="skeleton h-64 rounded-lg" />
        <div className="skeleton h-48 rounded-lg" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div className="page-header">
        <h1 className="page-title">Attendance Settings</h1>
        <p className="page-subtitle">Configure attendance session timings and academic calendar</p>
      </div>

      {/* ── Session Configuration Card ──────────────────────────── */}
      <div className="card">
        <div className="card-header">
          <div className="flex items-center gap-2">
            <Clock size={18} className="text-blue-600" />
            <span className="card-title">Session Configuration</span>
          </div>
        </div>
        <div className="card-body space-y-6">
          {sessions.map((session, index) => (
            <div key={session.id || index} className="p-4 border border-surface-200 rounded-lg space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="font-semibold text-surface-800">{session.session_name} Session</h4>
                <label className="flex items-center gap-2 cursor-pointer">
                  <div
                    onClick={() => updateSession(index, 'is_active', session.is_active ? 0 : 1)}
                    className={`relative w-10 h-5 rounded-full transition-colors cursor-pointer ${
                      session.is_active ? 'bg-blue-500' : 'bg-surface-300'
                    }`}
                  >
                    <div className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                      session.is_active ? 'translate-x-5' : 'translate-x-0'
                    }`} />
                  </div>
                  <span className="text-sm text-surface-600">{session.is_active ? 'Active' : 'Disabled'}</span>
                </label>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="form-label">Start Time</label>
                  <input
                    type="time"
                    className="form-input"
                    value={session.start_time || ''}
                    onChange={e => updateSession(index, 'start_time', e.target.value)}
                  />
                </div>
                <div>
                  <label className="form-label">End Time</label>
                  <input
                    type="time"
                    className="form-input"
                    value={session.end_time || ''}
                    onChange={e => updateSession(index, 'end_time', e.target.value)}
                  />
                </div>
                <div>
                  <label className="form-label">Grace Period (min)</label>
                  <input
                    type="number"
                    min="0"
                    max="60"
                    className="form-input"
                    value={session.grace_minutes || 0}
                    onChange={e => updateSession(index, 'grace_minutes', parseInt(e.target.value))}
                  />
                </div>
              </div>

              <p className="text-xs text-surface-400">
                Students can mark attendance between {session.start_time} and {session.end_time},
                with a {session.grace_minutes}-minute grace period.
              </p>
            </div>
          ))}

          {sessions.length === 0 && (
            <div className="text-center py-8 text-surface-400">No attendance sessions configured.</div>
          )}

          <div className="p-3 bg-amber-50 border border-amber-100 rounded-lg flex gap-2">
            <Info size={15} className="text-amber-600 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-amber-700">
              Session timings define when students are allowed to mark their attendance.
              Changes take effect immediately for all future attendance markings.
              <strong className="block mt-1">Afternoon session attendance is automatically recorded as Half Day (0.5).</strong>
            </p>
          </div>

          <button
            onClick={handleSaveSessions}
            disabled={savingSess || sessions.length === 0}
            className="btn-primary"
          >
            {savingSess ? <Loader size={15} className="animate-spin" /> : <Save size={15} />}
            Save Session Settings
          </button>
        </div>
      </div>

      {/* ── Academic Calendar Card ──────────────────────────────── */}
      <div className="card">
        <div className="card-header flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar size={18} className="text-blue-600" />
            <span className="card-title">Academic Calendar</span>
          </div>
          {!editMode ? (
            <button
              onClick={() => setEditMode(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50 transition-colors"
            >
              <Pencil size={14} /> Edit
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <button
                onClick={cancelEdit}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-surface-600 border border-surface-200 rounded-lg hover:bg-surface-50 transition-colors"
              >
                <X size={14} /> Cancel
              </button>
              <button
                onClick={handleSaveCalendar}
                disabled={savingWd}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-60"
              >
                {savingWd ? <Loader size={14} className="animate-spin" /> : <Check size={14} />}
                Save
              </button>
            </div>
          )}
        </div>

        <div className="card-body space-y-5">
          {loadingWd ? (
            <div className="animate-pulse space-y-3">
              <div className="skeleton h-8 rounded" />
              <div className="skeleton h-8 rounded" />
              <div className="skeleton h-12 rounded" />
            </div>
          ) : !editMode ? (
            /* ── READ-ONLY VIEW ── */
            <>
              <div className="p-3 bg-blue-50 border border-blue-100 rounded-lg flex gap-2">
                <Info size={15} className="text-blue-600 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-blue-700">
                  Working days and semester dates control how student attendance percentages and
                  working day counts are calculated across all dashboards.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="p-3 bg-surface-50 rounded-lg">
                  <div className="text-xs text-surface-500 mb-1">Academic Year</div>
                  <div className="font-semibold text-surface-800">{wd?.academic_year || '—'}</div>
                </div>
                <div className="p-3 bg-surface-50 rounded-lg">
                  <div className="text-xs text-surface-500 mb-1">Semester</div>
                  <div className="font-semibold text-surface-800">{wd?.semester_label || '—'}</div>
                </div>
                <div className="p-3 bg-surface-50 rounded-lg">
                  <div className="text-xs text-surface-500 mb-1">Semester Start</div>
                  <div className="font-semibold text-surface-800">{fmtDate(wd?.semester_start)}</div>
                </div>
                <div className="p-3 bg-surface-50 rounded-lg">
                  <div className="text-xs text-surface-500 mb-1">Semester End</div>
                  <div className="font-semibold text-surface-800">{fmtDate(wd?.semester_end)}</div>
                </div>
              </div>

              {/* Working days display */}
              <div className="p-3 bg-surface-50 rounded-lg">
                <div className="text-xs text-surface-500 mb-2">Working Days</div>
                <div className="flex flex-wrap gap-2">
                  {ALL_DAYS.map(day => {
                    const active = (wd?.working_days_json || []).includes(day);
                    return (
                      <span key={day} className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                        active
                          ? 'bg-blue-100 text-blue-700 border border-blue-200'
                          : 'bg-surface-100 text-surface-400 border border-surface-200'
                      }`}>
                        {DAY_SHORT[day]}
                      </span>
                    );
                  })}
                </div>
                <p className="text-xs text-surface-500 mt-2">{summariseDays(wd?.working_days_json)}</p>
              </div>
            </>
          ) : (
            /* ── EDIT FORM ── */
            <div className="space-y-4">
              <div className="p-3 bg-amber-50 border border-amber-100 rounded-lg flex gap-2">
                <Info size={15} className="text-amber-600 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-amber-700">
                  Changes here affect attendance percentage calculations for all students across all dashboards, history pages, and monitoring views.
                </p>
              </div>

              {/* Academic Year + Semester Label */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="form-label">Academic Year</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. 2024-25"
                    value={wdForm.academic_year}
                    onChange={e => setWdForm(p => ({ ...p, academic_year: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="form-label">Semester Label</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. Even Semester 2025"
                    value={wdForm.semester_label}
                    onChange={e => setWdForm(p => ({ ...p, semester_label: e.target.value }))}
                  />
                </div>
              </div>

              {/* Semester dates */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="form-label">Semester Start</label>
                  <input
                    type="date"
                    className="form-input"
                    value={wdForm.semester_start}
                    onChange={e => setWdForm(p => ({ ...p, semester_start: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="form-label">Semester End</label>
                  <input
                    type="date"
                    className="form-input"
                    value={wdForm.semester_end}
                    onChange={e => setWdForm(p => ({ ...p, semester_end: e.target.value }))}
                  />
                </div>
              </div>

              {/* Working days checkboxes */}
              <div>
                <label className="form-label">Working Days</label>
                <div className="flex flex-wrap gap-2 mt-1">
                  {ALL_DAYS.map(day => {
                    const checked = wdForm.working_days_json.includes(day);
                    return (
                      <button
                        key={day}
                        type="button"
                        onClick={() => toggleDay(day)}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-all ${
                          checked
                            ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                            : 'bg-white text-surface-600 border-surface-300 hover:border-blue-400 hover:text-blue-600'
                        }`}
                      >
                        {DAY_SHORT[day]}
                      </button>
                    );
                  })}
                </div>
                <p className="text-xs text-surface-400 mt-2">
                  Selected: <span className="font-medium text-surface-600">{summariseDays(wdForm.working_days_json)}</span>
                  {' '}({wdForm.working_days_json.length} day{wdForm.working_days_json.length !== 1 ? 's' : ''}/week)
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
