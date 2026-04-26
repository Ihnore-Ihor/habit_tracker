import { useMemo } from 'react';

// 1. ІМПОРТУЄМО ФАЙЛИ ПРЯМО В КОД (перевір правильність шляхів до твоїх svg!)
import frame1 from '../../assets/chinese-border-frame1.svg';
import frame2 from '../../assets/chinese-border-frame2.svg';
import frame3 from '../../assets/chinese-border-frame3.svg';
import frame4 from '../../assets/chinese-border-frame4.svg';
import frame5 from '../../assets/chinese-border-frame5.svg';

const FRAMES = {
  1: frame1,
  2: frame2,
  3: frame3,
  4: frame4,
  5: frame5,
};

export default function ChineseFrame({ 
  frame = 1, 
  size = 'md', 
  slice, 
  className = '', 
  children 
}) {
  const sizeClass = size === 'lg' ? 'chinese-frame--lg' : '';
  
  // Беремо правильний імпортований файл
  const url = FRAMES[frame] || FRAMES[1];

  // 2. ЗАДАЄМО СТИЛІ НАПРЯМУ В STYLE
  const inlineStyle = {
    borderImageSource: `url("${url}")`,
    borderImageSlice: slice !== undefined ? slice : (frame === 3 ? 25 : 60), // Твої вираховані зрізи
    borderImageRepeat: 'stretch',
    borderStyle: 'solid',
    borderWidth: size === 'lg' ? '24px' : '16px',
    backgroundColor: 'transparent',
    mixBlendMode: 'darken'
  };

  return (
    <div 
      className={`chinese-frame ${sizeClass} ${className}`}
      style={inlineStyle}
    >
      <div className="chinese-frame-content h-full w-full">
        {children}
      </div>
    </div>
  );
}
