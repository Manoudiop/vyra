import { fireEvent, render, screen } from '@testing-library/react-native';
import { Shirt } from 'lucide-react-native';
import { Button } from './Button';
import { Chip } from './Chip';
import { EmptyState } from './EmptyState';
import { TextField } from './TextField';

describe('Button', () => {
  it('calls onPress', async () => {
    const onPress = jest.fn();
    await render(<Button label="Continuer" onPress={onPress} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Continuer' }));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('is busy and inert while loading', async () => {
    const onPress = jest.fn();
    await render(<Button label="Envoyer" onPress={onPress} loading />);
    const button = screen.getByRole('button', { name: 'Envoyer' });
    expect(button).toBeBusy();
    expect(button).toBeDisabled();
    await fireEvent.press(button);
    expect(onPress).not.toHaveBeenCalled();
  });
});

describe('TextField', () => {
  it('shows the error message instead of the hint', async () => {
    await render(<TextField label="Email" hint="Ton email" error="Adresse email invalide" />);
    expect(screen.getByText('Adresse email invalide')).toBeTruthy();
    expect(screen.queryByText('Ton email')).toBeNull();
  });

  it('hides passwords until the toggle is pressed', async () => {
    await render(<TextField label="Mot de passe" password testID="pw" />);
    expect(screen.getByTestId('pw').props.secureTextEntry).toBe(true);
    await fireEvent.press(screen.getByRole('button', { name: 'Afficher le mot de passe' }));
    expect(screen.getByTestId('pw').props.secureTextEntry).toBe(false);
    expect(screen.getByRole('button', { name: 'Masquer le mot de passe' })).toBeTruthy();
  });
});

describe('Chip', () => {
  it('exposes its selected state', async () => {
    await render(<Chip label="Dîner" selected />);
    expect(screen.getByRole('button', { name: 'Dîner' })).toBeSelected();
  });
});

describe('EmptyState', () => {
  it('renders the call to action when provided', async () => {
    const onAction = jest.fn();
    await render(
      <EmptyState
        icon={Shirt}
        title="Vide"
        body="Rien ici"
        actionLabel="Ajouter"
        onAction={onAction}
      />,
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Ajouter' }));
    expect(onAction).toHaveBeenCalled();
  });
});
