import React, { useEffect, useState } from 'react';
import { Select } from '@/components/ui/select/Select';

export interface ReviewerChoice {
  id: string;
  name: string;
}

interface Props {
  /** Loads the people who may be given the campaign (those who may manage its reviews). */
  load: () => Promise<ReviewerChoice[]>;
  /** The chosen person's id; empty means the person who creates the campaign. */
  value: string;
  onChange: (id: string) => void;
  disabled?: boolean;
}

/**
 * The reviewer of a review campaign: the creator by default, or any person who may manage that kind of review. The list is the server's, so a person who cannot act on the campaign is
 * never offered; a list that cannot be read leaves the creator as the reviewer.
 */
export const ReviewerSelect: React.FC<Props> = ({ load, value, onChange, disabled }) => {
  const [choices, setChoices] = useState<ReviewerChoice[]>([]);
  useEffect(() => {
    let live = true;
    load().then((list) => live && setChoices(list)).catch(() => live && setChoices([]));
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <Select
      label="Reviewer"
      value={value}
      onChange={(id: string) => onChange(id)}
      options={[{ value: '', label: 'Me (the person creating the campaign)' }, ...choices.map((choice) => ({ value: choice.id, label: choice.name }))]}
      enableSearch
      disabled={disabled}
      aria-label="Reviewer"
    />
  );
};
