'use client';

import React, { useState, useEffect } from 'react';
import {
  UserPlus,
  Search,
  Loader2,
  Phone,
  Mail,
  BookOpen,
  Pencil,
  Trash2,
} from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { DeleteTrainerModal } from '@/components/trainers/DeleteTrainerModal';

export default function TrainersPage() {
  const [trainers, setTrainers] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTrainer, setEditingTrainer] = useState<any>(null);
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    specialization: '',
    notes: '',
  });
  const [modalLoading, setModalLoading] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  // Delete Modal State
  const [deleteModalTrainer, setDeleteModalTrainer] = useState<any>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  const fetchTrainers = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/trainers?search=${encodeURIComponent(search)}`);
      if (res.ok) {
        const json = await res.json();
        setTrainers(json.data || []);
      }
    } catch {
      // ignore
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTrainers();
  }, [search]);

  const handleOpenModal = (trainer?: any) => {
    if (trainer) {
      setEditingTrainer(trainer);
      setFormData({
        name: trainer.name,
        phone: trainer.phone || '',
        email: trainer.email || '',
        specialization: trainer.specialization || '',
        notes: trainer.notes || '',
      });
    } else {
      setEditingTrainer(null);
      setFormData({
        name: '',
        phone: '',
        email: '',
        specialization: '',
        notes: '',
      });
    }
    setModalError(null);
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalLoading(true);
    setModalError(null);

    try {
      const url = editingTrainer ? `/api/trainers/${editingTrainer.id}` : '/api/trainers';
      const method = editingTrainer ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to save trainer');
      }

      setIsModalOpen(false);
      fetchTrainers();
    } catch (err: any) {
      setModalError(err.message || 'Error occurred');
    } finally {
      setModalLoading(false);
    }
  };

  return (
    <div className="space-y-6 pb-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Instructors & Market Mentors
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Faculty directory for trading courses, price action specialists and mentors
          </p>
        </div>
        <Button
          variant="primary"
          onClick={() => handleOpenModal()}
          leftIcon={<UserPlus className="w-4 h-4" />}
          className="shrink-0 font-semibold"
        >
          Add New Instructor
        </Button>
      </div>

      {/* Search Bar */}
      <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm">
        <div className="relative max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search instructors by name, code or specialization..."
            className="w-full pl-9 pr-3.5 py-2 text-xs rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-[#0052CC] font-medium text-slate-900"
          />
        </div>
      </div>

      {/* Trainers Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {isLoading ? (
          <div className="col-span-full py-12 text-center text-xs text-slate-400">
            <Loader2 className="w-5 h-5 animate-spin mx-auto text-[#0052CC] mb-2" />
            Loading instructors...
          </div>
        ) : trainers.length === 0 ? (
          <div className="col-span-full py-12 text-center text-xs text-slate-500 bg-white rounded-xl border border-slate-200">
            No instructors found.
          </div>
        ) : (
          trainers.map((t) => (
            <div
              key={t.id}
              className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm hover:border-slate-300 transition-all flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-blue-50 text-[#0052CC] flex items-center justify-center font-bold text-sm">
                      {t.name
                        .split(' ')
                        .map((n: string) => n[0])
                        .join('')
                        .substring(0, 2)
                        .toUpperCase()}
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-900 text-sm">{t.name}</h3>
                      <span className="text-[10px] font-mono text-[#0052CC] bg-blue-50 px-2 py-0.5 rounded font-semibold border border-blue-200 inline-block mt-0.5">
                        {t.trainerCode}
                      </span>
                    </div>
                  </div>
                  <Badge status={t.status} />
                </div>

                <div className="mt-4 p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <span className="text-[10px] uppercase font-semibold text-slate-500 tracking-wider block">
                    Trading Specialization
                  </span>
                  <p className="text-xs font-semibold text-slate-900 mt-0.5">
                    {t.specialization || 'General Financial Markets'}
                  </p>
                </div>

                <div className="mt-3.5 space-y-1.5 text-xs text-slate-600">
                  {t.phone && (
                    <div className="flex items-center gap-2">
                      <Phone className="w-3.5 h-3.5 text-slate-400" />
                      <span>{t.phone}</span>
                    </div>
                  )}
                  {t.email && (
                    <div className="flex items-center gap-2">
                      <Mail className="w-3.5 h-3.5 text-slate-400" />
                      <span>{t.email}</span>
                    </div>
                  )}
                </div>

                {t.notes && (
                  <p className="mt-3 text-[11px] text-slate-500 italic line-clamp-2">
                    &ldquo;{t.notes}&rdquo;
                  </p>
                )}
              </div>

              <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                <span className="text-slate-500 font-medium flex items-center gap-1.5">
                  <BookOpen className="w-3.5 h-3.5 text-slate-400" />
                  <span>{t._count?.courses || 0} Assigned Courses</span>
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleOpenModal(t)}
                    className="font-medium text-slate-700 hover:text-[#0052CC] hover:bg-slate-50 px-2.5 py-1 rounded border border-slate-200 flex items-center gap-1 transition-colors"
                  >
                    <Pencil className="w-3 h-3 text-slate-500" /> Edit
                  </button>
                  <button
                    onClick={() => {
                      setDeleteModalTrainer({
                        id: t.id,
                        trainerCode: t.trainerCode,
                        name: t.name,
                        specialization: t.specialization,
                        coursesCount: t._count?.courses || 0,
                      });
                      setIsDeleteModalOpen(true);
                    }}
                    className="font-medium text-rose-600 hover:bg-rose-50 px-2.5 py-1 rounded border border-rose-200 flex items-center gap-1 transition-colors"
                  >
                    <Trash2 className="w-3 h-3 text-rose-500" /> Delete
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Add / Edit Trainer Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingTrainer ? 'Edit Instructor' : 'Add New Instructor'}
        subtitle="Instructor credentials and course specialties"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {modalError && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg">
              {modalError}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Full Name *
            </label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g. Farhan Khan"
              className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-[#0052CC]"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Phone Number
              </label>
              <input
                type="text"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="0312-xxxxxxx"
                className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-[#0052CC]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Email Address
              </label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="farhan@globaltrading.com"
                className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-[#0052CC]"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Trading Specialization
            </label>
            <input
              type="text"
              value={formData.specialization}
              onChange={(e) => setFormData({ ...formData, specialization: e.target.value })}
              placeholder="e.g. Price Action, Liquidity, Forex Scalping"
              className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-[#0052CC]"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Notes</label>
            <textarea
              rows={2}
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Instructor qualifications, certifications..."
              className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-[#0052CC]"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsModalOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="md" isLoading={modalLoading}>
              {editingTrainer ? 'Update Instructor' : 'Create Instructor'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete / Deactivate Trainer Modal */}
      <DeleteTrainerModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        trainer={deleteModalTrainer}
        onSuccess={() => {
          fetchTrainers();
        }}
      />
    </div>
  );
}
