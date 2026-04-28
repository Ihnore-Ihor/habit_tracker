import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import api from '../api/client.js'; // Використовуємо існуючий client.js

// Допоміжні конфіги для рівнів рідкості згідно з твоїм дизайном
const RARITY_CONFIG = {
  'Legendary': {
    color: '#8FBC8F',
    bgGradient: 'linear-gradient(135deg, rgba(143, 188, 143, 0.05) 0%, rgba(143, 188, 143, 0.15) 100%), rgba(255, 255, 255, 0.60)',
    boxShadow: '0px 0px 40px rgba(143, 188, 143, 0.30), 0px 0px 20px rgba(143, 188, 143, 0.60)',
    pillBg: 'rgba(143, 188, 143, 0.13)',
    label: 'Legendary (<1%)'
  },
  'Epic': {
    color: '#B8942E',
    borderColor: '#D4AF37',
    bgGradient: 'linear-gradient(135deg, rgba(212, 175, 55, 0.05) 0%, rgba(212, 175, 55, 0.12) 100%), rgba(255, 255, 255, 0.60)',
    boxShadow: '0px 0px 32px rgba(212, 175, 55, 0.20), 0px 0px 16px rgba(212, 175, 55, 0.50)',
    pillBg: 'rgba(212, 175, 55, 0.13)',
    label: 'Epic (1-5%)'
  },
  'Rare': {
    color: '#8B8B8B',
    borderColor: '#C0C0C0',
    bgGradient: 'linear-gradient(135deg, rgba(192, 192, 192, 0.03) 0%, rgba(192, 192, 192, 0.08) 100%), rgba(255, 255, 255, 0.60)',
    boxShadow: '0px 0px 12px rgba(192, 192, 192, 0.40)',
    pillBg: 'rgba(192, 192, 192, 0.13)',
    label: 'Rare (5-10%)'
  },
  'Common': {
    color: '#8B7355',
    borderColor: '#A0826D',
    bgGradient: 'linear-gradient(135deg, rgba(160, 130, 109, 0.02) 0%, rgba(160, 130, 109, 0.06) 100%), rgba(255, 255, 255, 0.60)',
    boxShadow: 'none',
    pillBg: 'rgba(160, 130, 109, 0.13)',
    label: 'Common (>10%)'
  },
  // Конфіг для ще не розблокованих (сірий дизайн)
  'Locked': {
    color: '#99A1AF',
    borderColor: '#999999',
    bgGradient: 'linear-gradient(135deg, rgba(128, 128, 128, 0.02) 0%, rgba(128, 128, 128, 0.05) 100%), rgba(255, 255, 255, 0.60)',
    boxShadow: 'none'
  }
};

const AwardsView = () => {
  const [awards, setAwards] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchAwards = async () => {
      try {
        const response = await api.get('/api/awards');
        setAwards(response.data);
      } catch (err) {
        console.error("Failed to fetch awards", err);
        setAwards([]); // Ніяких мокових даних!
      } finally {
        setIsLoading(false);
      }
    };
    fetchAwards();
  }, []);

  const unlockedCount = awards.filter(a => a.isUnlocked).length;
  const totalCount = awards.length || 1; // Уникаємо ділення на 0

  if (isLoading) return <div className="flex justify-center p-10 text-gray-400">Loading your legacy...</div>;

  // ДОДАЄМО ПЕРЕВІРКУ НА ПУСТИЙ МАСИВ
  if (!isLoading && awards.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center pt-20 pb-24 opacity-60 text-center gap-3">
        <span className="text-5xl grayscale">🏆</span>
        <p className="text-[14px] text-[#4A5565] font-medium mt-2">The Imperial Archives are empty.</p>
        <p className="text-[12px] text-[#99A1AF] max-w-[250px]">Wait for the content manager to add achievements to the database.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 pb-24">
      
      {/* ── HEADER & PROGRESS ── */}
      <div className="bg-[#F9F6EE]/95 backdrop-blur-md -mx-4 px-4 py-3 border-b border-gray-200/50 flex flex-col gap-3 sticky top-0 z-20">
        <div className="flex justify-between items-center">
          <h1 className="text-[18px] text-[#364153]">Achievements</h1>
          <div className="w-5 h-5 flex flex-wrap justify-center items-center gap-[1px]">
             <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M10 2L12 8L18 8L13 12L15 18L10 14L5 18L7 12L2 8L8 8L10 2Z" fill="#8FBC8F"/>
             </svg>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
            <motion.div 
              initial={{ width: 0 }} 
              animate={{ width: `${(unlockedCount / totalCount) * 100}%` }} 
              className="h-full bg-gradient-to-b from-[#8FBC8F] to-[#6B9B6B] rounded-full"
            />
          </div>
          <span className="text-[12px] font-semibold text-[#4A5565]">{unlockedCount}/{totalCount}</span>
        </div>
      </div>

      {/* ── LEGEND ── */}
      <div className="bg-white/40 rounded-[14px] p-4 outline outline-[0.5px] outline-gray-200 shadow-sm grid grid-cols-2 gap-y-3 gap-x-2">
        {['Legendary', 'Epic', 'Rare', 'Common'].map(tier => (
          <div key={tier} className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-[6px] border-[1.5px]" style={{ borderColor: RARITY_CONFIG[tier].borderColor || RARITY_CONFIG[tier].color }} />
            <span className="text-[10px] text-[#4A5565]">{RARITY_CONFIG[tier].label}</span>
          </div>
        ))}
      </div>

      {/* ── AWARDS LIST ── */}
      <div className="flex flex-col gap-4">
        {awards.map((award) => {
          const isUnlocked = award.isUnlocked;
          const config = isUnlocked ? RARITY_CONFIG[award.rarityTier] : RARITY_CONFIG['Locked'];
          const mainColor = config.borderColor || config.color;
          const iconUrl = award.iconUrl || `https://placehold.co/68x68/E8E8E8/99A1AF?text=${award.title.charAt(0)}`;

          return (
            <motion.div 
              initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
              key={award.id} 
              className="relative rounded-[14px] p-5 outline outline-[2.5px] outline-offset-[-2.5px] overflow-hidden shadow-sm transition-all hover:scale-[1.01]"
              style={{ 
                background: config.bgGradient,
                boxShadow: config.boxShadow,
                outlineColor: mainColor
              }}
            >
              {/* Кутові декоративні L-лінії */}
              <div className="absolute top-2.5 left-2.5 w-4 h-4 rounded-tl-[10px] border-t-[1.5px] border-l-[1.5px]" style={{ borderColor: mainColor }} />
              <div className="absolute top-2.5 right-2.5 w-4 h-4 rounded-tr-[10px] border-t-[1.5px] border-r-[1.5px]" style={{ borderColor: mainColor }} />
              <div className="absolute bottom-2.5 left-2.5 w-4 h-4 rounded-bl-[10px] border-b-[1.5px] border-l-[1.5px]" style={{ borderColor: mainColor }} />
              <div className="absolute bottom-2.5 right-2.5 w-4 h-4 rounded-br-[10px] border-b-[1.5px] border-r-[1.5px]" style={{ borderColor: mainColor }} />

              <div className="flex items-start gap-4 z-10 relative">
                
                <div className="relative shrink-0">
                  <div className={`w-[68px] h-[68px] rounded-lg overflow-hidden ${!isUnlocked ? 'opacity-40 grayscale' : ''}`}>
                    <img 
                      src={iconUrl} 
                      alt={award.title} 
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  </div>
                  {!isUnlocked && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-7 h-7 bg-[#6A7282]/80 backdrop-blur-sm rounded-lg flex items-center justify-center outline outline-[2px] outline-white/20">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                          <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                        </svg>
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex-1 flex flex-col pt-0.5">
                  <h3 className="text-[16px] font-semibold leading-tight" style={{ color: config.color }}>
                    {award.title}
                  </h3>
                  <p className="text-[12px] text-[#4A5565] mt-1 mb-3 leading-snug pr-2">
                    {award.description}
                  </p>

                  {isUnlocked ? (
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full w-max" style={{ backgroundColor: config.pillBg }}>
                      <div className="w-[10px] h-[10px] rounded-sm border" style={{ borderColor: config.color }} />
                      <span className="text-[10px] font-semibold" style={{ color: config.color }}>
                        Obtained by {Number(award.unlockRatePct).toFixed(1)}%
                      </span>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-1.5 mt-auto w-full max-w-[200px]">
                      <div className="flex justify-between items-center text-[10px]">
                        <span className="text-[#6A7282]">Progress</span>
                        <span className="text-[#6A7282] font-semibold">{award.currentProgress}/{award.targetValue}</span>
                      </div>
                      <div className="h-1.5 w-full bg-[#E5E7EB] rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-gradient-to-r from-[#99A1AF] to-[#6A7282] rounded-full transition-all duration-500" 
                          style={{ width: `${Math.min(100, (award.currentProgress / award.targetValue) * 100)}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>

              </div>
            </motion.div>
          );
        })}
      </div>

      {/* ── QUOTE ── */}
      <div className="bg-white/40 rounded-[14px] p-4 outline outline-[0.5px] outline-gray-200 shadow-sm flex flex-col gap-2 mt-4">
        <p className="text-center text-[12px] text-[#4A5565] italic leading-relaxed">
          "Each achievement carved in jade tells the story of dedication and perseverance."
        </p>
        <span className="text-center text-[#8FBC8F] text-[10px]">— Imperial Archives</span>
      </div>

    </div>
  );
};

export default AwardsView;
