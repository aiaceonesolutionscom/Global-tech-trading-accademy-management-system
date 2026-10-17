'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import {
  Settings,
  Save,
  CheckCircle2,
  Building2,
  Receipt,
  Percent,
  Bell,
  Loader2,
  CreditCard,
  FileText,
  Plus,
  Trash2,
  ShieldCheck,
  KeyRound,
  Eye,
  EyeOff,
  Lock,
  AlertCircle,
  Sparkles,
  Copy,
  Check,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<
    'company' | 'payment' | 'policy' | 'billing' | 'tax' | 'notifications' | 'security'
  >('company');

  const [settings, setSettings] = useState<any>({
    company_name: 'Global Tech International Academy',
    company_tagline: 'Global Trading, Investment & Education',
    company_division: 'Global Tech International Academy — Finance Division',
    company_greeting: 'Thank You For Your Business!',
    receipt_greeting: 'Thank You For Your Payment!',
    company_phone: '0345 3191304 | 0311 8317978 | 0314 0039852',
    company_email: 'accounts@globaltech.edu.pk',
    company_city: 'Karachi, Pakistan',
    company_website: '',
    company_address: 'B-156, Block 6, Gulshan-e-Iqbal, Karachi',
    company_tax_id: 'NTN-8947291-0',

    bank_name: 'Meezan Bank Ltd',
    bank_account_name: 'Global Tech Academy',
    bank_account_number: '0102-0105849301',
    bank_iban: 'PK45MEZN0001020105849301',

    policy_title: 'Official Instructions & Policy:',
    policy_line_1: '1. Fee deposited is non-refundable & non-transferable.',
    policy_line_2: '2. Computer-verified voucher. Valid without physical stamp.',
    policy_line_3: '3. Accounts helpdesk: accounts@globaltech.edu.pk',
    policy_lines_json: '',

    invoice_prefix: 'GT-INV-',
    receipt_prefix: 'GT-REC-',
    currency_symbol: 'Rs.',
    default_billing_mode: 'MONTHLY',
    tax_name: 'GST',
    default_tax_rate: '0',
    due_days_threshold: '5',
    auto_reminders_enabled: 'true',
  });

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Security & Password States
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/settings', { cache: 'no-store' })
      .then((res) => res.json())
      .then((data) => {
        if (data.settings) {
          setSettings((prev: any) => ({ ...prev, ...data.settings }));
        }
      })
      .catch(() => {})
      .finally(() => setIsLoading(false));

    fetch('/api/auth/me')
      .then((res) => res.json())
      .then((data) => {
        if (data?.authenticated && data?.user) {
          setCurrentUser(data.user);
        }
      })
      .catch(() => {});

    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('tab') === 'security') {
        setActiveTab('security');
      }
    }
  }, []);

  const [copiedPassword, setCopiedPassword] = useState(false);

  // Strong password generator
  const generateStrongPassword = () => {
    const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
    const lower = 'abcdefghijkmnopqrstuvwxyz';
    const numbers = '23456789';
    const symbols = '!@#$%^&*_-+=';

    const pick = (str: string) => str[Math.floor(Math.random() * str.length)];
    const chars = [
      pick(upper),
      pick(upper),
      pick(lower),
      pick(lower),
      pick(numbers),
      pick(numbers),
      pick(symbols),
      pick(symbols),
    ];

    const all = upper + lower + numbers + symbols;
    for (let i = 0; i < 4; i++) {
      chars.push(pick(all));
    }

    const generated = chars.sort(() => Math.random() - 0.5).join('');

    setPasswordForm((prev) => ({
      ...prev,
      newPassword: generated,
      confirmPassword: generated,
    }));
    setShowNewPassword(true);
    setShowConfirmPassword(true);
    setPasswordError(null);
  };

  const handleCopyPassword = () => {
    if (!passwordForm.newPassword) return;
    navigator.clipboard.writeText(passwordForm.newPassword);
    setCopiedPassword(true);
    setTimeout(() => setCopiedPassword(false), 2000);
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);
    setPasswordSuccess(null);

    if (!passwordForm.currentPassword) {
      setPasswordError('Please enter your current password.');
      return;
    }

    if (passwordForm.newPassword.length < 8) {
      setPasswordError('New password must be at least 8 characters long.');
      return;
    }

    if (!/[A-Z]/.test(passwordForm.newPassword)) {
      setPasswordError('Strong password required: Must contain at least one uppercase letter (A-Z).');
      return;
    }

    if (!/[a-z]/.test(passwordForm.newPassword)) {
      setPasswordError('Strong password required: Must contain at least one lowercase letter (a-z).');
      return;
    }

    if (!/[0-9]/.test(passwordForm.newPassword)) {
      setPasswordError('Strong password required: Must contain at least one number (0-9).');
      return;
    }

    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(passwordForm.newPassword)) {
      setPasswordError('Strong password required: Must contain at least one special symbol (!@#$%^&*).');
      return;
    }

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordError('New password and confirm password do not match.');
      return;
    }

    setIsUpdatingPassword(true);
    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(passwordForm),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to update password');
      }

      setPasswordSuccess(data.message || 'Password updated successfully!');
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setTimeout(() => setPasswordSuccess(null), 5000);
    } catch (err: any) {
      setPasswordError(err.message || 'An error occurred while updating password.');
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  const handleChange = (key: string, value: string) => {
    setSettings((prev: any) => ({ ...prev, [key]: value }));
  };

  const getPolicyLines = (): string[] => {
    if (settings.policy_lines_json) {
      try {
        const parsed = JSON.parse(settings.policy_lines_json);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch {}
    }
    const legacy = [settings.policy_line_1, settings.policy_line_2, settings.policy_line_3].filter(
      (l) => typeof l === 'string' && l.trim() !== ''
    );
    if (legacy.length > 0) return legacy;
    const email = settings.company_email?.trim();
    return [
      '1. Fee deposited is non-refundable & non-transferable.',
      '2. Computer-verified voucher. Valid without physical stamp.',
      email ? `3. Accounts helpdesk: ${email}` : '3. Official computer-generated voucher.',
    ];
  };

  const handlePolicyLinesChange = (newLines: string[]) => {
    setSettings((prev: any) => ({
      ...prev,
      policy_lines_json: JSON.stringify(newLines),
      policy_line_1: newLines[0] || '',
      policy_line_2: newLines[1] || '',
      policy_line_3: newLines[2] || '',
    }));
  };

  const handleUpdatePolicyLine = (index: number, value: string) => {
    const lines = [...getPolicyLines()];
    lines[index] = value;
    handlePolicyLinesChange(lines);
  };

  const handleAddPolicyLine = () => {
    const lines = [...getPolicyLines()];
    const nextNumber = lines.length + 1;
    lines.push(`${nextNumber}. `);
    handlePolicyLinesChange(lines);
  };

  const handleRemovePolicyLine = (index: number) => {
    const lines = [...getPolicyLines()];
    if (lines.length <= 1) return;
    lines.splice(index, 1);
    handlePolicyLinesChange(lines);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSuccessMessage(null);

    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });

      if (res.ok) {
        setSuccessMessage('Settings updated successfully!');
        setTimeout(() => setSuccessMessage(null), 3500);
      }
    } catch {
      // ignore
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="p-8 text-xs text-slate-400 text-center">
        <Loader2 className="w-5 h-5 animate-spin mx-auto text-[#0052CC] mb-2" />
        Loading system settings...
      </div>
    );
  }

  const tabs = [
    { id: 'company', label: 'Company & Branding', Icon: Building2 },
    { id: 'payment', label: 'Bank & Payment Details', Icon: CreditCard },
    { id: 'policy', label: 'Invoice Terms & Policy', Icon: FileText },
    { id: 'billing', label: 'Billing & Sequencing', Icon: Receipt },
    { id: 'tax', label: 'Tax & GST', Icon: Percent },
    { id: 'notifications', label: 'Alerts & Reminders', Icon: Bell },
    { id: 'security', label: 'Security & Password', Icon: ShieldCheck },
  ];

  // Live Password Strength Computation
  const hasMinLength = passwordForm.newPassword.length >= 8;
  const hasUpper = /[A-Z]/.test(passwordForm.newPassword);
  const hasLower = /[a-z]/.test(passwordForm.newPassword);
  const hasNumber = /[0-9]/.test(passwordForm.newPassword);
  const hasSpecial = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(passwordForm.newPassword);
  const strengthScore = [hasMinLength, hasUpper, hasLower, hasNumber, hasSpecial].filter(Boolean).length;
  const isStrong = strengthScore === 5;

  return (
    <form onSubmit={handleSave} className="space-y-6 pb-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            System & Institutional Settings
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Database-backed configuration for company branding, bank accounts, policy terms, and invoices
          </p>
        </div>
        {activeTab !== 'security' && (
          <Button
            type="submit"
            variant="primary"
            size="md"
            isLoading={isSaving}
            leftIcon={<Save className="w-4 h-4" />}
            className="shrink-0 font-semibold"
          >
            Save All Changes
          </Button>
        )}
      </div>

      {successMessage && (
        <div className="p-4 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-semibold flex items-center gap-2.5 shadow-sm">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* Settings Navigation Tabs */}
      <div className="bg-white rounded-xl p-2 border border-slate-200 shadow-sm flex flex-wrap items-center gap-2">
        {tabs.map((tab) => {
          const Icon = tab.Icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors flex items-center gap-2 ${
                isActive
                  ? 'bg-[#0052CC] text-white shadow-sm'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab 1: Company Profile & Branding */}
      {activeTab === 'company' && (
        <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm space-y-5">
          <div className="flex items-center justify-between border-b border-slate-200 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-slate-100 border border-slate-200 p-1 flex items-center justify-center">
                <Image src="/favicon.png" alt="Logo" width={28} height={28} className="object-contain" />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  Company & Institutional Information
                </h2>
                <p className="text-xs text-slate-500">
                  Displayed on official PDF fee invoices, voucher headers, and payment receipts
                </p>
              </div>
            </div>
          </div>



          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Company / Academy Name
              </label>
              <input
                type="text"
                value={settings.company_name}
                onChange={(e) => handleChange('company_name', e.target.value)}
                className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-[#0052CC]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Tagline / Subtext
              </label>
              <input
                type="text"
                value={settings.company_tagline}
                onChange={(e) => handleChange('company_tagline', e.target.value)}
                className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-[#0052CC]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Finance Division Label
              </label>
              <input
                type="text"
                value={settings.company_division}
                onChange={(e) => handleChange('company_division', e.target.value)}
                placeholder="Global Tech International Academy — Finance Division"
                className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-[#0052CC]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Invoice Customer Greeting
              </label>
              <input
                type="text"
                value={settings.company_greeting}
                onChange={(e) => handleChange('company_greeting', e.target.value)}
                placeholder="Thank You For Your Business!"
                className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-[#0052CC]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Official Helpdesk Phone Numbers
              </label>
              <input
                type="text"
                value={settings.company_phone}
                onChange={(e) => handleChange('company_phone', e.target.value)}
                placeholder="0345 3191304 | 0311 8317978 | 0314 0039852"
                className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-[#0052CC]"
              />
              <p className="text-[11px] text-slate-500 mt-1">
                You can enter 1, 2, or 3 phone numbers separated by | (e.g. 0345 3191304 | 0311 8317978 | 0314 0039852)
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Official Accounts Email
              </label>
              <input
                type="email"
                value={settings.company_email}
                onChange={(e) => handleChange('company_email', e.target.value)}
                placeholder="accounts@globaltech.edu.pk"
                className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-[#0052CC]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                City / Location
              </label>
              <input
                type="text"
                value={settings.company_city}
                onChange={(e) => handleChange('company_city', e.target.value)}
                placeholder="Karachi, Pakistan"
                className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-[#0052CC]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Official Website URL
              </label>
              <input
                type="text"
                value={settings.company_website}
                onChange={(e) => handleChange('company_website', e.target.value)}
                placeholder="e.g. www.globaltech.edu.pk (Optional)"
                className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-[#0052CC]"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Campus / Head Office Address
              </label>
              <input
                type="text"
                value={settings.company_address}
                onChange={(e) => handleChange('company_address', e.target.value)}
                placeholder="B-156, Block 6, Gulshan-e-Iqbal, Karachi"
                className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-[#0052CC]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Tax Registration / NTN
              </label>
              <input
                type="text"
                value={settings.company_tax_id}
                onChange={(e) => handleChange('company_tax_id', e.target.value)}
                className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-[#0052CC]"
              />
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Bank & Payment Method Details */}
      {activeTab === 'payment' && (
        <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm space-y-6">
          <div className="border-b border-slate-200 pb-4">
            <h2 className="text-base font-bold text-slate-900">
              Bank Account & Payment Method Details
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              These details appear on student fee invoices and payment vouchers for fee deposits
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Bank Name
              </label>
              <input
                type="text"
                value={settings.bank_name}
                onChange={(e) => handleChange('bank_name', e.target.value)}
                placeholder="Meezan Bank Ltd"
                className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-[#0052CC]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Account Title / Name
              </label>
              <input
                type="text"
                value={settings.bank_account_name}
                onChange={(e) => handleChange('bank_account_name', e.target.value)}
                placeholder="Global Tech Academy"
                className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-[#0052CC]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Account Number
              </label>
              <input
                type="text"
                value={settings.bank_account_number}
                onChange={(e) => handleChange('bank_account_number', e.target.value)}
                placeholder="0102-0105849301"
                className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-300 bg-white font-mono focus:outline-none focus:ring-2 focus:ring-[#0052CC]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                IBAN Number
              </label>
              <input
                type="text"
                value={settings.bank_iban}
                onChange={(e) => handleChange('bank_iban', e.target.value)}
                placeholder="PK45MEZN0001020105849301"
                className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-300 bg-white font-mono uppercase focus:outline-none focus:ring-2 focus:ring-[#0052CC]"
              />
            </div>
          </div>

          {/* Live Preview Box */}
          <div className="p-4 rounded-lg bg-slate-50 border border-slate-200">
            <h3 className="text-xs font-bold text-[#001B48] uppercase tracking-wider mb-2">
              Invoice Live Preview:
            </h3>
            <div className="space-y-1 text-xs text-slate-600">
              <p><span className="text-slate-500">Bank Name:</span> <strong className="text-slate-800">{settings.bank_name || 'Meezan Bank Ltd'}</strong></p>
              <p><span className="text-slate-500">Account Name:</span> <strong className="text-slate-800">{settings.bank_account_name || 'Global Tech Academy'}</strong></p>
              <p><span className="text-slate-500">Account Number:</span> <strong className="text-slate-800 font-mono">{settings.bank_account_number || '0102-0105849301'}</strong></p>
              <p><span className="text-slate-500">IBAN:</span> <strong className="text-slate-800 font-mono">{settings.bank_iban || 'PK45MEZN0001020105849301'}</strong></p>
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Invoice Terms & Policy */}
      {activeTab === 'policy' && (
        <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm space-y-6">
          <div className="border-b border-slate-200 pb-4">
            <h2 className="text-base font-bold text-slate-900">
              Official Instructions & Policy Terms
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Configure multiple terms, refund rules, and verification clauses printed on fee vouchers and PDFs
            </p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Policy Section Title
              </label>
              <input
                type="text"
                value={settings.policy_title}
                onChange={(e) => handleChange('policy_title', e.target.value)}
                placeholder="Official Instructions & Policy:"
                className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-[#0052CC]"
              />
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-semibold text-slate-700">
                  Instruction Clauses / Policy Lines ({getPolicyLines().length} Lines)
                </label>
                <button
                  type="button"
                  onClick={handleAddPolicyLine}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-white bg-[#0052CC] hover:bg-blue-700 shadow-xs transition-colors cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>+ Add Clause / Line</span>
                </button>
              </div>

              {getPolicyLines().map((line, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <span className="shrink-0 w-20 text-center font-bold text-[11px] text-slate-600 bg-slate-100 py-2 rounded-lg border border-slate-200">
                    Clause {idx + 1}
                  </span>
                  <input
                    type="text"
                    value={line}
                    onChange={(e) => handleUpdatePolicyLine(idx, e.target.value)}
                    placeholder={`e.g. ${idx + 1}. Instruction or policy clause...`}
                    className="flex-1 px-3.5 py-2 text-sm rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-[#0052CC]"
                  />
                  {getPolicyLines().length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemovePolicyLine(idx)}
                      className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                      title="Delete Clause"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Live Preview Box */}
          <div className="p-4 rounded-lg bg-slate-50 border border-slate-200">
            <h3 className="text-xs font-bold text-[#001B48] uppercase tracking-wider mb-2">
              Policy Card Live Preview:
            </h3>
            <div className="space-y-1 text-xs text-slate-600">
              <p className="font-semibold text-slate-800">{settings.policy_title || 'Official Instructions & Policy:'}</p>
              {getPolicyLines().map((line, idx) => (
                <p key={idx}>{line}</p>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Tab 4: Billing & Sequencing */}
      {activeTab === 'billing' && (
        <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm space-y-4">
          <h2 className="text-base font-bold text-slate-900">
            Billing, Invoicing & Sequence Rules
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Invoice Number Prefix
              </label>
              <input
                type="text"
                value={settings.invoice_prefix}
                onChange={(e) => handleChange('invoice_prefix', e.target.value)}
                className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-300 bg-white font-mono font-semibold"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Payment Receipt Prefix
              </label>
              <input
                type="text"
                value={settings.receipt_prefix}
                onChange={(e) => handleChange('receipt_prefix', e.target.value)}
                className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-300 bg-white font-mono font-semibold"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Currency Symbol
              </label>
              <input
                type="text"
                value={settings.currency_symbol}
                onChange={(e) => handleChange('currency_symbol', e.target.value)}
                className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-300 bg-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Default Course Billing Mode
              </label>
              <select
                value={settings.default_billing_mode}
                onChange={(e) => handleChange('default_billing_mode', e.target.value)}
                className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-300 bg-white"
              >
                <option value="MONTHLY">Monthly Installment</option>
                <option value="ONE_TIME">One-Time Fee</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Tab 5: Tax & GST */}
      {activeTab === 'tax' && (
        <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm space-y-4">
          <h2 className="text-base font-bold text-slate-900">Tax Configuration</h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Default Tax Label Name
              </label>
              <input
                type="text"
                value={settings.tax_name}
                onChange={(e) => handleChange('tax_name', e.target.value)}
                placeholder="e.g. GST, Sales Tax, Service Tax"
                className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-300 bg-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Default Tax Rate (%)
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={settings.default_tax_rate}
                onChange={(e) => handleChange('default_tax_rate', e.target.value)}
                className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-300 bg-white"
              />
            </div>
          </div>
        </div>
      )}

      {/* Tab 6: Notifications & Reminders */}
      {activeTab === 'notifications' && (
        <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm space-y-4">
          <h2 className="text-base font-bold text-slate-900">Automated Reminder Rules</h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Upcoming Due Threshold (Days)
              </label>
              <input
                type="number"
                min="1"
                max="30"
                value={settings.due_days_threshold}
                onChange={(e) => handleChange('due_days_threshold', e.target.value)}
                className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-300 bg-white"
              />
              <p className="text-[11px] text-slate-500 mt-1">
                Flags unpaid bills approaching due date within this number of days.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Tab 7: Security & Password */}
      {activeTab === 'security' && (
        <div className="space-y-6">
          {/* Admin Profile Overview */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-[#001B48] text-white flex items-center justify-center font-bold text-lg shadow-sm">
                  {currentUser?.name ? currentUser.name.charAt(0).toUpperCase() : 'GT'}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-bold text-slate-900">
                      {currentUser?.name || 'Administrator'}
                    </h2>
                    <span className="bg-blue-50 text-[#0052CC] border border-blue-200 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase font-mono">
                      {currentUser?.role || 'ADMIN'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 font-mono mt-0.5">
                    {currentUser?.email || 'admin@globaltrading.com'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 bg-emerald-50 text-emerald-700 border border-emerald-200/80 px-3 py-1.5 rounded-xl text-xs font-semibold self-start sm:self-auto">
                <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Protected by HTTP-Only JWT & bcrypt hash</span>
              </div>
            </div>
          </div>

          {/* Change Password Card */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-5">
            {/* Card Header with Suggest Password Button */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-50 text-[#0052CC] flex items-center justify-center">
                  <KeyRound className="w-4.5 h-4.5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Change Account Password</h3>
                  <p className="text-xs text-slate-500">
                    Enforces strong password policy (uppercase, lowercase, numbers, symbols)
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={generateStrongPassword}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold text-[#0052CC] bg-blue-50 hover:bg-blue-100 border border-blue-200 transition-colors cursor-pointer self-start sm:self-auto shadow-2xs"
                title="Automatically generate and fill a strong password"
              >
                <Sparkles className="w-3.5 h-3.5 text-[#0052CC]" />
                <span>Suggest Strong Password</span>
              </button>
            </div>

            {passwordSuccess && (
              <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2.5 shadow-xs">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{passwordSuccess}</span>
              </div>
            )}

            {passwordError && (
              <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-center gap-2.5 shadow-xs">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{passwordError}</span>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Current Password */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Current Password <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type={showCurrentPassword ? 'text' : 'password'}
                    value={passwordForm.currentPassword}
                    onChange={(e) =>
                      setPasswordForm((prev) => ({ ...prev, currentPassword: e.target.value }))
                    }
                    placeholder="Enter existing password"
                    className="w-full pl-3.5 pr-10 py-2.5 text-xs rounded-xl border border-slate-300 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0052CC]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                    className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    {showCurrentPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              {/* New Password */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-semibold text-slate-700">
                    New Password <span className="text-rose-500">*</span>
                  </label>
                  {passwordForm.newPassword && (
                    <button
                      type="button"
                      onClick={handleCopyPassword}
                      className="text-[11px] font-semibold text-[#0052CC] hover:text-blue-700 flex items-center gap-1 cursor-pointer"
                      title="Copy password to clipboard"
                    >
                      {copiedPassword ? (
                        <>
                          <Check className="w-3 h-3 text-emerald-600" />
                          <span className="text-emerald-600 font-bold">Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3 text-slate-400" />
                          <span>Copy</span>
                        </>
                      )}
                    </button>
                  )}
                </div>
                <div className="relative">
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    value={passwordForm.newPassword}
                    onChange={(e) =>
                      setPasswordForm((prev) => ({ ...prev, newPassword: e.target.value }))
                    }
                    placeholder="Min 8 chars with Upper, Lower, Numbers, Symbols"
                    className="w-full pl-3.5 pr-10 py-2.5 text-xs rounded-xl border border-slate-300 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0052CC]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Confirm New Password */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Confirm New Password <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={passwordForm.confirmPassword}
                    onChange={(e) =>
                      setPasswordForm((prev) => ({ ...prev, confirmPassword: e.target.value }))
                    }
                    placeholder="Re-type new password"
                    className="w-full pl-3.5 pr-10 py-2.5 text-xs rounded-xl border border-slate-300 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0052CC]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    {showConfirmPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>
            </div>

            {/* Live Strength Meter & Validation Pills */}
            {passwordForm.newPassword && (
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/80 space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-700">Password Strength:</span>
                  <span
                    className={`font-bold font-mono text-[11px] px-2.5 py-0.5 rounded-full ${
                      isStrong
                        ? 'bg-emerald-100 text-emerald-800'
                        : strengthScore >= 3
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-rose-100 text-rose-800'
                    }`}
                  >
                    {isStrong
                      ? 'Strong (Ready to Save)'
                      : strengthScore >= 3
                      ? 'Moderate (Needs remaining symbols/numbers)'
                      : 'Weak (Too Simple)'}
                  </span>
                </div>

                {/* Progress Bar */}
                <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all duration-300 ${
                      isStrong
                        ? 'bg-emerald-500 w-full'
                        : strengthScore >= 3
                        ? 'bg-amber-500 w-3/5'
                        : 'bg-rose-500 w-1/4'
                    }`}
                  />
                </div>

                {/* Requirements Checklist */}
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-1 text-[11px]">
                  <div
                    className={`flex items-center gap-1.5 px-2 py-1 rounded-lg border font-medium ${
                      hasMinLength
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : 'bg-white text-slate-400 border-slate-200'
                    }`}
                  >
                    <Check className={`w-3 h-3 ${hasMinLength ? 'text-emerald-600' : 'text-slate-300'}`} />
                    <span>8+ Characters</span>
                  </div>

                  <div
                    className={`flex items-center gap-1.5 px-2 py-1 rounded-lg border font-medium ${
                      hasUpper
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : 'bg-white text-slate-400 border-slate-200'
                    }`}
                  >
                    <Check className={`w-3 h-3 ${hasUpper ? 'text-emerald-600' : 'text-slate-300'}`} />
                    <span>Upper (A-Z)</span>
                  </div>

                  <div
                    className={`flex items-center gap-1.5 px-2 py-1 rounded-lg border font-medium ${
                      hasLower
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : 'bg-white text-slate-400 border-slate-200'
                    }`}
                  >
                    <Check className={`w-3 h-3 ${hasLower ? 'text-emerald-600' : 'text-slate-300'}`} />
                    <span>Lower (a-z)</span>
                  </div>

                  <div
                    className={`flex items-center gap-1.5 px-2 py-1 rounded-lg border font-medium ${
                      hasNumber
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : 'bg-white text-slate-400 border-slate-200'
                    }`}
                  >
                    <Check className={`w-3 h-3 ${hasNumber ? 'text-emerald-600' : 'text-slate-300'}`} />
                    <span>Number (0-9)</span>
                  </div>

                  <div
                    className={`flex items-center gap-1.5 px-2 py-1 rounded-lg border font-medium ${
                      hasSpecial
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : 'bg-white text-slate-400 border-slate-200'
                    }`}
                  >
                    <Check className={`w-3 h-3 ${hasSpecial ? 'text-emerald-600' : 'text-slate-300'}`} />
                    <span>Symbol (!@#$)</span>
                  </div>
                </div>
              </div>
            )}

            <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <p className="text-[11px] text-slate-500">
                {!passwordForm.newPassword
                  ? 'Enter a password or click "Suggest Strong Password".'
                  : !isStrong
                  ? '⚠️ Strong password policy: Must meet all 5 requirements above.'
                  : passwordForm.newPassword !== passwordForm.confirmPassword
                  ? '⚠️ Passwords do not match yet.'
                  : '✅ Strong password requirements satisfied.'}
              </p>

              <Button
                type="button"
                variant="primary"
                size="md"
                disabled={
                  !isStrong ||
                  !passwordForm.currentPassword ||
                  passwordForm.newPassword !== passwordForm.confirmPassword
                }
                isLoading={isUpdatingPassword}
                onClick={handlePasswordSubmit}
                leftIcon={<Lock className="w-4 h-4" />}
                className="font-bold text-xs"
              >
                Update Password
              </Button>
            </div>
          </div>

          {/* Security Recommendations Banner */}
          <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200/80 text-xs text-slate-600 space-y-1.5">
            <h4 className="font-bold text-slate-800 flex items-center gap-1.5 text-xs">
              <ShieldCheck className="w-4 h-4 text-[#0052CC]" />
              Account Security Best Practices
            </h4>
            <ul className="list-disc pl-5 space-y-1 text-slate-500 text-[11px]">
              <li>Never share your administrator login password with students or unauthorized staff.</li>
              <li>Always choose a unique passphrase combining letters, numbers, and symbols.</li>
              <li>Your password is encrypted using high-cost bcrypt hashing and is never stored in plaintext.</li>
            </ul>
          </div>
        </div>
      )}
    </form>
  );
}
