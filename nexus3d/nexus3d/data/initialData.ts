
import { Node, Link, AuditLogEntry } from '../types';

export const initialNodes: Node[] = [
  { id: '1', name: 'Li Wei', phone: '13800138000', weight: 8, category: 'Tech', organization: 'Nexus Corp', position: 'Engineering', title: 'Senior Architect', bio: 'Expert in distributed systems and 3D visualization architectures.', createdBy: 'system' },
  { id: '2', name: 'Sarah Chen', phone: '13811138111', weight: 6, category: 'Design', organization: 'Creative Studio', position: 'Design Team', title: 'UX Lead', bio: 'Award-winning designer focusing on immersive digital experiences.', createdBy: 'system' },
  { id: '3', name: 'Robert Zhang', phone: '13822238222', weight: 4, category: 'Business', organization: 'Nexus Corp', position: 'Product', title: 'Product Manager', bio: 'Strategic thinker bridging the gap between tech and market needs.', createdBy: 'system' },
  { id: '4', name: 'Emily Wong', phone: '13833338333', weight: 9, category: 'Business', organization: 'Nexus Corp', position: 'Management', title: 'CEO', bio: 'Visionary leader driving the next generation of social networking.', createdBy: 'system' },
  { id: '5', name: 'John Doe', phone: '13844438444', weight: 2, category: 'Other', organization: 'Freelance', position: 'Community', title: 'Contributor', bio: 'An active contributor to open-source relationship mapping projects.', createdBy: 'sa-1' },
  { id: '6', name: 'Marcus Aurelius', weight: 10, category: 'Government', organization: 'Roman Empire', position: 'Leadership', title: 'Emperor', bio: 'Stoic philosopher and ruler who emphasized duty and justice.', createdBy: 'system' },
  { id: '7', name: 'Elena Petrova', weight: 7, category: 'Tech', organization: 'OpenAI', position: 'Research', title: 'AI Scientist', bio: 'Researcher focused on large language models and human-AI interaction.', createdBy: 'system' },
  { id: '8', name: 'David Kim', weight: 5, category: 'Design', organization: 'Pixels Inc', position: 'Creative', title: 'Motion Lead', bio: 'Specialist in dynamic transitions and 3D interface feedback.', createdBy: 'system' },
  { id: '9', name: 'Sofia Garcia', weight: 6, category: 'Business', organization: 'Horizon Venture', position: 'Investment', title: 'Partner', bio: 'Venture capitalist focusing on early-stage spatial computing startups.', createdBy: 'system' },
  { id: '10', name: 'Kenji Sato', weight: 3, category: 'Tech', organization: 'DevShop', position: 'Web', title: 'Full-stack Dev', bio: 'Passionate about React, Three.js and real-time data sync.', createdBy: 'system' },
  { id: '11', name: 'Alice M. Smith', weight: 8, category: 'Social', organization: 'Global Times', position: 'Editorial', title: 'Editor-in-Chief', bio: 'Investigative journalist uncovering hidden social networks.', createdBy: 'system' },
  { id: '12', name: 'Oscar Wilde', weight: 7, category: 'Other', organization: 'Independent', position: 'Arts', title: 'Author/Critic', bio: 'Witty observer of Victorian social structures.', createdBy: 'system' },
  { id: '13', name: 'Marie Curie', weight: 10, category: 'Tech', organization: 'University of Paris', position: 'Physics', title: 'Professor', bio: 'Pioneering researcher on radioactivity and two-time Nobel prize winner.', createdBy: 'system' },
  { id: '14', name: 'Leo DaVinci', weight: 9, category: 'Design', organization: 'Renaissance Arts', position: 'Master', title: 'Polymath', bio: 'Inventor, artist, and scientist who mapped the human form and nature.', createdBy: 'system' },
  { id: '15', name: 'Grace Hopper', weight: 9, category: 'Tech', organization: 'US Navy', position: 'Computing', title: 'Rear Admiral', bio: 'Computer science pioneer who developed the first compiler.', createdBy: 'system' },
  { id: '16', name: 'Ada Lovelace', weight: 8, category: 'Tech', organization: 'Analytical Engine', position: 'Mathematics', title: 'Programmer', bio: 'The first person to recognize the full potential of a "computing machine".', createdBy: 'system' },
  { id: '17', name: 'Steve Wozniak', weight: 9, category: 'Tech', organization: 'Apple Inc', position: 'Engineering', title: 'Co-Founder', bio: 'The engineering genius behind the personal computer revolution.', createdBy: 'system' },
  { id: '18', name: 'Zaha Hadid', weight: 9, category: 'Design', organization: 'Hadid Architects', position: 'Design', title: 'Principal Architect', bio: 'Futuristic architect known for radical deconstructivist designs.', createdBy: 'system' },
  { id: '19', name: 'Miles Davis', weight: 6, category: 'Social', organization: 'Jazz Foundation', position: 'Music', title: 'Trumpeter', bio: 'Pioneered several jazz styles, including cool jazz and fusion.', createdBy: 'system' },
  { id: '20', name: 'Frida Kahlo', weight: 7, category: 'Other', organization: 'Modern Art', position: 'Artist', title: 'Painter', bio: 'Renowned for self-portraits exploring identity, post-colonialism, and gender.', createdBy: 'system' },
  { id: '21', name: 'Niels Bohr', weight: 8, category: 'Tech', organization: 'Bohr Institute', position: 'Physics', title: 'Director', bio: 'Contributed foundational understandings of atomic structure and quantum theory.', createdBy: 'system' },
  { id: '22', name: 'Jeff Bezos', weight: 10, category: 'Business', organization: 'Amazon', position: 'Board', title: 'Executive Chair', bio: 'Entrepreneur who revolutionized global e-commerce and logistics.', createdBy: 'system' },
  { id: '23', name: 'Oprah Winfrey', weight: 10, category: 'Social', organization: 'Harpo Prods', position: 'Media', title: 'Chairwoman', bio: 'Influential talk show host and philanthropist.', createdBy: 'system' },
  { id: '24', name: 'Elon Musk', weight: 10, category: 'Tech', organization: 'SpaceX / Tesla', position: 'Executive', title: 'CEO', bio: 'Leading missions to Mars and accelerating the transition to sustainable energy.', createdBy: 'system' },
  { id: '25', name: 'Malala Yousafzai', weight: 9, category: 'Government', organization: 'UN / Malala Fund', position: 'Advocacy', title: 'Messenger of Peace', bio: 'Advocate for female education and the youngest Nobel Prize laureate.', createdBy: 'system' },
];

export const initialLinks: Link[] = [
  { id: 'l1', source: '4', target: '1', type: 'Work_Superior', strength: 9, createdBy: 'system' },
  { id: 'l2', source: '1', target: '2', type: 'Work_Partner', strength: 7, createdBy: 'system' },
  { id: 'l3', source: '2', target: '3', type: 'Work_Subordinate', strength: 5, createdBy: 'system' },
  { id: 'l4', source: '3', target: '4', type: 'Friend', strength: 3, createdBy: 'system' },
  { id: 'l5', source: '5', target: '1', type: 'Family_ParentChild', strength: 10, createdBy: 'sa-1' },
  { id: 'l6', source: '4', target: '9', type: 'Work_Partner', strength: 8, createdBy: 'system' },
  { id: 'l7', source: '9', target: '22', type: 'Work_Partner', strength: 6, createdBy: 'system' },
  { id: 'l8', source: '22', target: '24', type: 'Friend', strength: 5, createdBy: 'system' },
  { id: 'l9', source: '24', target: '17', type: 'Work_Partner', strength: 7, createdBy: 'system' },
  { id: 'l10', source: '17', target: '16', type: 'Friend', strength: 4, createdBy: 'system' },
  { id: 'l11', source: '16', target: '15', type: 'Work_Partner', strength: 9, createdBy: 'system' },
  { id: 'l12', source: '15', target: '13', type: 'Work_Partner', strength: 7, createdBy: 'system' },
  { id: 'l13', source: '6', target: '11', type: 'Friend', strength: 5, createdBy: 'system' },
  { id: 'l14', source: '11', target: '23', type: 'Work_Partner', strength: 9, createdBy: 'system' },
  { id: 'l15', source: '23', target: '25', type: 'Friend', strength: 8, createdBy: 'system' },
  { id: 'l16', source: '18', target: '14', type: 'Work_Partner', strength: 6, createdBy: 'system' },
  { id: 'l17', source: '14', target: '20', type: 'Friend', strength: 5, createdBy: 'system' },
  { id: 'l18', source: '20', target: '19', type: 'Friend', strength: 4, createdBy: 'system' },
  { id: 'l19', source: '21', target: '13', type: 'Work_Partner', strength: 10, createdBy: 'system' },
  { id: 'l20', source: '7', target: '10', type: 'Work_Partner', strength: 8, createdBy: 'system' },
  { id: 'l21', source: '10', target: '1', type: 'Friend', strength: 6, createdBy: 'system' },
  { id: 'l22', source: '8', target: '2', type: 'Work_Partner', strength: 9, createdBy: 'system' },
  { id: 'l23', source: '12', target: '14', type: 'Friend', strength: 7, createdBy: 'system' },
];

export const initialLogs: AuditLogEntry[] = [
  { id: 'log1', timestamp: Date.now() - 100000, userId: 'system', userName: 'Administrator', action: 'VERSION_UPDATE', details: 'Initial snapshot of the v1.1.8 relationship network with enhanced entity attributes.' }
];
