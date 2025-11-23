import { useState } from 'react';
import Plasma from '../components/Plasma';

interface OptionButtonProps {
  text: string;
  isSelected: boolean;
  onClick: () => void;
}

function OptionButton({ text, isSelected, onClick }: OptionButtonProps) {
  return (
    <button
      onClick={onClick}
      className={`box-border content-stretch flex gap-[10px] items-center justify-center px-[24px] py-[10px] relative rounded-[16px] shadow-[0px_4px_4px_0px_rgba(0,0,0,0.25)] shrink-0 transition-colors cursor-pointer ${
        isSelected ? 'bg-[#7b61ff]' : 'bg-white'
      }`}
    >
      <p className={`font-['Inter:Medium',sans-serif] font-medium leading-[normal] not-italic relative shrink-0 text-[20px] text-nowrap whitespace-pre ${
        isSelected ? 'text-white' : 'text-black'
      }`}>{text}</p>
    </button>
  );
}

interface OnBoardingProps {
  onComplete: () => void;
}

export default function OnBoarding({ onComplete }: OnBoardingProps) {
  const [selectedPurchases, setSelectedPurchases] = useState<string[]>([]);
  const [selectedMotivations, setSelectedMotivations] = useState<string[]>([]);
  const [selectedChallenges, setSelectedChallenges] = useState<string[]>([]);
  const [selectedTone, setSelectedTone] = useState<string | null>(null);

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

  const toggleSelection = (
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

  const handleSubmit = () => {
    onComplete();
  };

  return (
    <div className="bg-[#1e1e1e] relative min-h-screen overflow-y-auto overflow-x-hidden" data-name="OnBoarding 3">
      {/* Dynamic Plasma Background - Fixed to viewport */}
      <div className="fixed inset-0 w-full h-full">
        <Plasma 
          color="#FFA7CE"
          speed={0.6}
          direction="forward"
          scale={1.1}
          opacity={0.3}
          mouseInteractive={true}
        />
      </div>
      
      {/* Content Container - centered with max-width */}
      <div className="relative mx-auto w-full max-w-[85%] px-4 pt-24 pb-12 flex flex-col gap-48">
        {/* Question 1 */}
        <div className="flex flex-col gap-6">
          <div className="text-center">
            <p className="font-['Plus_Jakarta_Sans:Medium',sans-serif] font-medium leading-[normal] text-[28px] text-white">What types of online purchases do you make?</p>
            <p className="font-['Plus_Jakarta_Sans:Regular',sans-serif] font-normal leading-[normal] text-[24px] text-white mt-2">Select all that apply</p>
          </div>
          
          <div className="flex gap-[32px] items-center justify-center flex-wrap">
            {purchaseOptions.slice(0, 3).map((option) => (
              <OptionButton
                key={option}
                text={option}
                isSelected={selectedPurchases.includes(option)}
                onClick={() => toggleSelection(option, selectedPurchases, setSelectedPurchases)}
              />
            ))}
          </div>
          
          <div className="flex gap-[32px] items-center justify-center flex-wrap">
            {purchaseOptions.slice(3).map((option) => (
              <OptionButton
                key={option}
                text={option}
                isSelected={selectedPurchases.includes(option)}
                onClick={() => toggleSelection(option, selectedPurchases, setSelectedPurchases)}
              />
            ))}
          </div>
        </div>

        {/* Question 2 */}
        <div className="flex flex-col gap-6">
          <div className="text-center">
            <p className="font-['Plus_Jakarta_Sans:Medium',sans-serif] font-medium leading-[normal] text-[28px] text-white">What Motivates You to Save or Invest?</p>
            <p className="font-['Plus_Jakarta_Sans:Regular',sans-serif] font-normal leading-[normal] text-[24px] text-white mt-2">Select all that apply</p>
          </div>
          
          <div className="flex gap-[32px] items-center justify-center flex-wrap">
            {motivationOptions.slice(0, 2).map((option) => (
              <OptionButton
                key={option}
                text={option}
                isSelected={selectedMotivations.includes(option)}
                onClick={() => toggleSelection(option, selectedMotivations, setSelectedMotivations)}
              />
            ))}
          </div>
          
          <div className="flex gap-[32px] items-center justify-center flex-wrap">
            {motivationOptions.slice(2, 4).map((option) => (
              <OptionButton
                key={option}
                text={option}
                isSelected={selectedMotivations.includes(option)}
                onClick={() => toggleSelection(option, selectedMotivations, setSelectedMotivations)}
              />
            ))}
          </div>

          <div className="flex gap-[32px] items-center justify-center flex-wrap">
            {motivationOptions.slice(4).map((option) => (
              <OptionButton
                key={option}
                text={option}
                isSelected={selectedMotivations.includes(option)}
                onClick={() => toggleSelection(option, selectedMotivations, setSelectedMotivations)}
              />
            ))}
          </div>
        </div>

        {/* Question 3 */}
        <div className="flex flex-col gap-6">
          <div className="text-center">
            <p className="font-['Plus_Jakarta_Sans:Medium',sans-serif] font-medium leading-[normal] text-[28px] text-white">What part of money management feels the hardest?</p>
            <p className="font-['Plus_Jakarta_Sans:Regular',sans-serif] font-normal leading-[normal] text-[24px] text-white mt-2">Select all that apply</p>
          </div>
          
          <div className="flex gap-[32px] items-center justify-center flex-wrap">
            {challengeOptions.slice(0, 3).map((option) => (
              <OptionButton
                key={option}
                text={option}
                isSelected={selectedChallenges.includes(option)}
                onClick={() => toggleSelection(option, selectedChallenges, setSelectedChallenges)}
              />
            ))}
          </div>
          
          <div className="flex gap-[32px] items-center justify-center flex-wrap">
            {challengeOptions.slice(3).map((option) => (
              <OptionButton
                key={option}
                text={option}
                isSelected={selectedChallenges.includes(option)}
                onClick={() => toggleSelection(option, selectedChallenges, setSelectedChallenges)}
              />
            ))}
          </div>
        </div>

        {/* Question 4 */}
        <div className="flex flex-col gap-6">
          <div className="text-center">
            <p className="font-['Plus_Jakarta_Sans:Medium',sans-serif] font-medium leading-[normal] text-[28px] text-white">How would you like your advisor to speak to you?</p>
            <p className="font-['Plus_Jakarta_Sans:Regular',sans-serif] font-normal leading-[normal] text-[24px] text-white mt-2">Control how your advisor delivers advice</p>
          </div>
          
          <div className="flex gap-[32px] items-center justify-center flex-wrap">
            {toneOptions.map((option) => (
              <OptionButton
                key={option}
                text={option}
                isSelected={selectedTone === option}
                onClick={() => setSelectedTone(option)}
              />
            ))}
          </div>
        </div>

        {/* Submit Button */}
        <div className="flex justify-center">
          <button
            onClick={handleSubmit}
            className="bg-[rgb(255,167,206)] box-border flex gap-[10px] items-center justify-center px-[24px] py-[10px] rounded-[12px] w-[290px] cursor-pointer hover:bg-[#6a50ef] transition-colors"
          >
            <p className="font-['Inter:Medium',sans-serif] font-medium leading-[normal] not-italic shrink-0 text-[24px] text-nowrap text-white whitespace-pre">Submit</p>
          </button>
        </div>
      </div>
    </div>
  );
}
