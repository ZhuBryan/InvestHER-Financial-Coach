import { useState, CSSProperties } from 'react';
import { motion } from 'framer-motion';
import Plasma from '../components/Plasma';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../supabaseClient';

const styles = {
  container: {
    position: 'relative' as const,
    minHeight: '100vh',
    height: '100vh',
    backgroundColor: '#1e1e1e',
    overflow: 'hidden' as const,
  },
  backgroundFixed: {
    position: 'fixed' as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100vw',
    height: '100vh',
    pointerEvents: 'none' as const,
    zIndex: 0,
  },
  scrollContainer: {
    position: 'relative' as const,
    height: '100vh',
    overflowY: 'auto' as const,
    overflowX: 'hidden' as const,
    scrollSnapType: 'y mandatory' as const,
    scrollBehavior: 'smooth' as const,
    zIndex: 1,
    WebkitOverflowScrolling: 'touch' as const,
  },
  section: {
    position: 'relative' as const,
    minHeight: '100vh',
    height: '100vh',
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'center',
    padding: '3rem 1.5rem',
    scrollSnapAlign: 'start' as const,
    scrollSnapStop: 'always' as const,
  },
  contentWrapper: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '2rem',
    maxWidth: '64rem',
    width: '100%',
    margin: '0 auto',
  },
  titleContainer: {
    textAlign: 'center' as const,
    marginBottom: '0.5rem',
  },
  title: {
    fontFamily: 'Plus Jakarta Sans, sans-serif',
    fontWeight: 600,
    fontSize: 'clamp(1.5rem, 4vw, 2rem)',
    color: 'white',
    marginBottom: '0.75rem',
    lineHeight: 1.2,
  },
  subtitle: {
    fontFamily: 'Plus Jakarta Sans, sans-serif',
    fontWeight: 400,
    fontSize: 'clamp(1rem, 2.5vw, 1.25rem)',
    color: 'rgba(255, 255, 255, 0.85)',
  },
  optionsContainer: {
    display: 'flex',
    gap: '1rem',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'wrap' as const,
    maxWidth: '56rem',
    margin: '0 auto',
  },
  submitContainer: {
    display: 'flex',
    justifyContent: 'center',
    marginTop: '1rem',
  },
  scrollIndicator: {
    position: 'absolute' as const,
    bottom: '2rem',
    left: 0,
    right: 0,
    margin: '0 auto',
    width: 'fit-content',
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    gap: '0.5rem',
    opacity: 0.6,
    pointerEvents: 'none' as const,
  },
  scrollIndicatorText: {
    fontFamily: 'Plus Jakarta Sans, sans-serif',
    fontSize: '0.875rem',
    color: 'white',
  },
  scrollIndicatorArrow: {
    width: '24px',
    height: '24px',
    borderLeft: '2px solid white',
    borderBottom: '2px solid white',
    transform: 'rotate(-45deg)',
  },
} as const;

const getButtonStyle = (isSelected: boolean): CSSProperties => ({
  padding: '0.75rem 1.75rem',
  borderRadius: '1rem',
  fontFamily: 'Plus Jakarta Sans, sans-serif',
  fontWeight: 500,
  fontSize: 'clamp(0.95rem, 2vw, 1.125rem)',
  transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
  boxShadow: isSelected
    ? '0 8px 16px rgba(123, 97, 255, 0.3)'
    : '0 4px 6px rgba(0, 0, 0, 0.1)',
  cursor: 'pointer',
  border: 'none',
  backgroundColor: isSelected ? '#7b61ff' : 'white',
  color: isSelected ? 'white' : 'black',
  transform: 'scale(1)',
  userSelect: 'none' as const,
});

const submitButtonStyle: CSSProperties = {
  background: 'linear-gradient(135deg, #f472b6 0%, #a855f7 100%)',
  color: 'white',
  fontFamily: 'Plus Jakarta Sans, sans-serif',
  fontWeight: 600,
  fontSize: 'clamp(1.125rem, 2.5vw, 1.375rem)',
  padding: '1rem 3.5rem',
  borderRadius: '1rem',
  boxShadow: '0 12px 24px rgba(168, 85, 247, 0.4)',
  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
  minWidth: '280px',
  border: 'none',
  cursor: 'pointer',
  userSelect: 'none' as const,
};

interface OptionButtonProps {
  text: string;
  isSelected: boolean;
  onClick: () => void;
}

function OptionButton({ text, isSelected, onClick }: OptionButtonProps) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <motion.button
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.98 }}
      style={{
        ...getButtonStyle(isSelected),
        ...(isHovered && !isSelected ? { backgroundColor: '#f3f4f6' } : {}),
      }}
    >
      {text}
    </motion.button>
  );
}

interface QuestionSectionProps {
  title: string;
  subtitle: string;
  options: string[];
  selectedItems: string[] | string | null;
  onToggle: (item: string) => void;
  singleSelect?: boolean;
  showScrollIndicator?: boolean;
  isLastSection?: boolean;
  children?: React.ReactNode;
}

function QuestionSection({
  title,
  subtitle,
  options,
  selectedItems,
  onToggle,
  singleSelect = false,
  showScrollIndicator = false,
  isLastSection = false,
  children,
}: QuestionSectionProps) {
  const isSelected = (option: string) => {
    if (singleSelect) {
      return selectedItems === option;
    }
    return Array.isArray(selectedItems) && selectedItems.includes(option);
  };

  return (
    <div style={styles.section}>
      <motion.div
        style={styles.contentWrapper}
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
        viewport={{ once: true }}
      >
        <div style={styles.titleContainer}>
          <motion.h2
            style={styles.title}
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            viewport={{ once: true }}
          >
            {title}
          </motion.h2>
          <motion.p
            style={styles.subtitle}
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            viewport={{ once: true }}
          >
            {subtitle}
          </motion.p>
        </div>

        <motion.div
          style={styles.optionsContainer}
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          viewport={{ once: true }}
        >
          {options.map((option, index) => (
            <motion.div
              key={option}
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.35 + index * 0.05 }}
              viewport={{ once: true }}
            >
              <OptionButton
                text={option}
                isSelected={isSelected(option)}
                onClick={() => onToggle(option)}
              />
            </motion.div>
          ))}
        </motion.div>

        {children}
      </motion.div>

      {showScrollIndicator && !isLastSection && (
        <motion.div
          style={styles.scrollIndicator}
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 0.6, y: 0 }}
          transition={{
            duration: 1.5,
            repeat: Infinity,
            repeatType: 'reverse',
          }}
        >
          <span style={styles.scrollIndicatorText}>Scroll for more</span>
          <div style={styles.scrollIndicatorArrow} />
        </motion.div>
      )}
    </div>
  );
}

interface OnBoardingProps {
  onComplete: () => void;
}

export default function OnBoarding({ onComplete }: OnBoardingProps) {
  const { user } = useAuth();
  const [selectedPurchases, setSelectedPurchases] = useState<string[]>([]);
  const [selectedMotivations, setSelectedMotivations] = useState<string[]>([]);
  const [selectedChallenges, setSelectedChallenges] = useState<string[]>([]);
  const [selectedTone, setSelectedTone] = useState<string | null>(null);
  const [isSubmitHovered, setIsSubmitHovered] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const purchaseOptions = [
    'Clothing & Fashion',
    'Beauty & Personal Care',
    'Home & Lifestyle',
    'Electronics',
    'Gifts',
    'Health & Wellness',
    'Others'
  ];

  const motivationOptions = [
    'I want to feel more financially safe',
    "I'm saving for something important",
    'I want to save in case of emergencies',
    'I want my money to grow over time',
    'I want more control over my money and choices.',
    'Other reasons'
  ];

  const challengeOptions = [
    'Sticking to a budget.',
    'Avoiding impulse purchases.',
    'Understanding investing terms.',
    'Knowing how much to save.',
    'Keeping track of my spending.',
    'Other reasons'
  ];

  const toneOptions = ['Educative', 'Casual', 'Harsh'];

  const toggleMultiSelection = (
    item: string,
    selectedItems: string[],
    setSelectedItems: (items: string[]) => void
  ) => {
    if (selectedItems.includes(item)) {
      setSelectedItems(selectedItems.filter(i => i !== item));
    } else {
      setSelectedItems([...selectedItems, item]);
    }
  };

  const isFormValid = 
    selectedPurchases.length > 0 &&
    selectedMotivations.length > 0 &&
    selectedChallenges.length > 0 &&
    selectedTone !== null;

  const handleSubmit = async () => {
    if (!user || !isFormValid) return;
    setIsSubmitting(true);

    try {
      const { error } = await supabase
        .from('user_profiles')
        .upsert({
          user_id: user.id,
          preferences: selectedPurchases,
          motivations: selectedMotivations,
          struggles: selectedChallenges,
          tone: selectedTone,
          updated_at: new Date().toISOString(),
        });

      if (error) throw error;
      onComplete();
    } catch (error) {
      console.error('Error saving onboarding data:', error);
      // Optionally handle error (e.g. show toast)
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={styles.container}>
      {/* Dynamic Plasma Background - Fixed to viewport, no clipping */}
      <div style={styles.backgroundFixed}>
        <Plasma
          color="#FFA7CE"
          speed={0.3}
          direction="forward"
          scale={1.05}
          opacity={0.25}
          mouseInteractive={false}
        />
      </div>

      {/* Scroll Container with Snap */}
      <div style={styles.scrollContainer}>
        {/* Question 1: Purchase Types */}
        <QuestionSection
          title="What types of online purchases do you make?"
          subtitle="Select all that apply"
          options={purchaseOptions}
          selectedItems={selectedPurchases}
          onToggle={(item) => toggleMultiSelection(item, selectedPurchases, setSelectedPurchases)}
          showScrollIndicator={true}
        />

        {/* Question 2: Motivations */}
        <QuestionSection
          title="What Motivates You to Save or Invest?"
          subtitle="Select all that apply"
          options={motivationOptions}
          selectedItems={selectedMotivations}
          onToggle={(item) => toggleMultiSelection(item, selectedMotivations, setSelectedMotivations)}
          showScrollIndicator={true}
        />

        {/* Question 3: Challenges */}
        <QuestionSection
          title="What part of money management feels the hardest?"
          subtitle="Select all that apply"
          options={challengeOptions}
          selectedItems={selectedChallenges}
          onToggle={(item) => toggleMultiSelection(item, selectedChallenges, setSelectedChallenges)}
          showScrollIndicator={true}
        />

        {/* Question 4: Tone Preference */}
        <QuestionSection
          title="How would you like your advisor to speak to you?"
          subtitle="Control how your advisor delivers advice"
          options={toneOptions}
          selectedItems={selectedTone}
          onToggle={(item) => setSelectedTone(item)}
          singleSelect={true}
        >
          <motion.div
            style={styles.submitContainer}
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, delay: 0.5 }}
            viewport={{ once: true }}
          >
            <motion.button
              onClick={handleSubmit}
              disabled={isSubmitting || !isFormValid}
              onMouseEnter={() => setIsSubmitHovered(true)}
              onMouseLeave={() => setIsSubmitHovered(false)}
              whileHover={isFormValid ? { scale: 1.05, boxShadow: '0 16px 32px rgba(168, 85, 247, 0.5)' } : {}}
              whileTap={isFormValid ? { scale: 0.98 } : {}}
              style={{
                ...submitButtonStyle,
                ...(isSubmitHovered && isFormValid ? {
                  background: 'linear-gradient(135deg, #a855f7 0%, #9333ea 100%)',
                } : {}),
                opacity: (isSubmitting || !isFormValid) ? 0.5 : 1,
                cursor: (isSubmitting || !isFormValid) ? 'not-allowed' : 'pointer',
                filter: !isFormValid ? 'grayscale(100%)' : 'none',
              }}
            >
              {isSubmitting ? 'Saving...' : 'Submit'}
            </motion.button>
          </motion.div>
        </QuestionSection>
      </div>
    </div>
  );
}
