'use client'

import React, { useEffect, useState } from 'react'
import { Star, ShieldCheck, HeartHandshake, Clock, ThumbsUp, RefreshCw } from 'lucide-react'

interface ReviewItem {
  id: string
  customer_name: string
  caregiver_name: string
  rating_overall: number
  rating_professionalism: number
  rating_punctuality: number
  rating_quality: number
  comment: string | null
  created_at: string
}

export default function ReviewsPage() {
  const [reviews, setReviews] = useState<ReviewItem[]>([])

  useEffect(() => {
    // Sample review feed for operational monitoring
    setReviews([
      {
        id: '1',
        customer_name: 'Abebe Bikila',
        caregiver_name: 'Sister Almaz',
        rating_overall: 5,
        rating_professionalism: 5,
        rating_punctuality: 5,
        rating_quality: 5,
        comment: 'Sister Almaz was very gentle, punctual, and thoroughly professional! My father was well taken care of.',
        created_at: '2026-10-06T14:30:00Z',
      },
      {
        id: '2',
        customer_name: 'Sara Tesfaye',
        caregiver_name: 'Daniel Yohannes',
        rating_overall: 5,
        rating_professionalism: 5,
        rating_punctuality: 4,
        rating_quality: 5,
        comment: 'Great wound dressing change, sterile technique was properly followed. Highly recommend.',
        created_at: '2026-10-05T11:15:00Z',
      },
    ])
  }, [])

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-[#151A19]">Quality & Reviews</h2>
        <p className="text-sm text-[#5A6360]">Customer satisfaction ratings and clinical service feedback</p>
      </div>

      {/* Aggregate Scorecards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="p-5 bg-white rounded-xl border border-[#E6E9E8] shadow-sm">
          <div className="text-xs font-semibold text-[#5A6360] uppercase">Composite Score</div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-[#0F6B5C]">4.95</span>
            <span className="text-xs text-emerald-700">★★★★★</span>
          </div>
          <div className="mt-2 text-xs text-[#5A6360]">Based on 23 completed visits</div>
        </div>

        <div className="p-5 bg-white rounded-xl border border-[#E6E9E8] shadow-sm">
          <div className="text-xs font-semibold text-[#5A6360] uppercase">Professionalism</div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-[#151A19]">5.0</span>
            <span className="text-xs text-[#5A6360]">/ 5.0</span>
          </div>
          <div className="mt-2 text-xs text-[#5A6360]">Clinical etiquette & bedside manner</div>
        </div>

        <div className="p-5 bg-white rounded-xl border border-[#E6E9E8] shadow-sm">
          <div className="text-xs font-semibold text-[#5A6360] uppercase">Punctuality</div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-[#151A19]">4.8</span>
            <span className="text-xs text-[#5A6360]">/ 5.0</span>
          </div>
          <div className="mt-2 text-xs text-[#5A6360]">Arrival within 15 min window</div>
        </div>

        <div className="p-5 bg-white rounded-xl border border-[#E6E9E8] shadow-sm">
          <div className="text-xs font-semibold text-[#5A6360] uppercase">Care Quality</div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-[#151A19]">5.0</span>
            <span className="text-xs text-[#5A6360]">/ 5.0</span>
          </div>
          <div className="mt-2 text-xs text-[#5A6360]">Procedure execution & treatment</div>
        </div>
      </div>

      {/* Review Feed */}
      <div className="bg-white rounded-xl border border-[#E6E9E8] shadow-sm overflow-hidden">
        <div className="p-6 border-b border-[#E6E9E8]">
          <h3 className="font-bold text-base text-[#151A19]">Recent Patient & Family Feedback</h3>
          <p className="text-xs text-[#5A6360]">Direct post-visit evaluations submitted from mobile app</p>
        </div>

        <div className="divide-y divide-[#E6E9E8]">
          {reviews.map((r) => (
            <div key={r.id} className="p-6 space-y-3 hover:bg-[#F7F8F7]/40 transition">
              <div className="flex items-start justify-between">
                <div>
                  <div className="font-bold text-sm text-[#151A19]">{r.customer_name}</div>
                  <div className="text-xs text-[#5A6360]">
                    Care delivered by <span className="font-medium text-[#0F6B5C]">{r.caregiver_name}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1 text-amber-500 font-bold text-sm">
                  {Array.from({ length: r.rating_overall }).map((_, i) => (
                    <span key={i}>★</span>
                  ))}
                </div>
              </div>

              {r.comment && (
                <p className="text-sm text-[#151A19] bg-[#F7F8F7] p-3 rounded-lg border border-[#E6E9E8]">
                  "{r.comment}"
                </p>
              )}

              <div className="flex items-center gap-6 text-xs text-[#5A6360]">
                <span>Professionalism: <strong>{r.rating_professionalism}/5</strong></span>
                <span>Punctuality: <strong>{r.rating_punctuality}/5</strong></span>
                <span>Quality: <strong>{r.rating_quality}/5</strong></span>
                <span className="ml-auto">{new Date(r.created_at).toLocaleDateString()}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
