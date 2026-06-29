/**
 * arXiv 分类缩写 → 全称映射
 * 参考: https://arxiv.org/category_taxonomy
 */
export const ARXIV_CATEGORY_NAMES: Record<string, string> = {
  // Computer Science
  'cs.AI': 'Artificial Intelligence',
  'cs.CL': 'Computation and Language (NLP)',
  'cs.CV': 'Computer Vision and Pattern Recognition',
  'cs.LG': 'Machine Learning',
  'cs.AR': 'Hardware Architecture',
  'cs.CC': 'Computational Complexity',
  'cs.CE': 'Computational Engineering',
  'cs.CG': 'Computational Geometry',
  'cs.CR': 'Cryptography and Security',
  'cs.CY': 'Computers and Society',
  'cs.DB': 'Databases',
  'cs.DC': 'Distributed Computing',
  'cs.DL': 'Digital Libraries',
  'cs.DM': 'Discrete Mathematics',
  'cs.DS': 'Data Structures and Algorithms',
  'cs.ET': 'Emerging Technologies',
  'cs.FL': 'Formal Languages and Automata Theory',
  'cs.GL': 'General Literature',
  'cs.GR': 'Graphics',
  'cs.GT': 'Computer Science and Game Theory',
  'cs.HC': 'Human-Computer Interaction',
  'cs.IR': 'Information Retrieval',
  'cs.IT': 'Information Theory',
  'cs.LO': 'Logic in Computer Science',
  'cs.MA': 'Multiagent Systems',
  'cs.MM': 'Multimedia',
  'cs.MS': 'Mathematical Software',
  'cs.NA': 'Numerical Analysis',
  'cs.NE': 'Neural and Evolutionary Computing',
  'cs.NI': 'Networking and Internet Architecture',
  'cs.OH': 'Other Computer Science',
  'cs.OS': 'Operating Systems',
  'cs.PF': 'Performance',
  'cs.PL': 'Programming Languages',
  'cs.RO': 'Robotics',
  'cs.SC': 'Symbolic Computation',
  'cs.SD': 'Sound',
  'cs.SE': 'Software Engineering',
  'cs.SI': 'Social and Information Networks',
  'cs.SY': 'Systems and Control',

  // Statistics
  'stat.ML': 'Machine Learning (Statistics)',
  'stat.AP': 'Applications (Statistics)',
  'stat.CO': 'Computation (Statistics)',
  'stat.ME': 'Methodology (Statistics)',
  'stat.TH': 'Theory (Statistics)',

  // Mathematics
  'math.OC': 'Optimization and Control',
  'math.ST': 'Statistics Theory',

  // Electrical Engineering
  'eess.AS': 'Audio and Speech Processing',
  'eess.IV': 'Image and Video Processing',
  'eess.SP': 'Signal Processing',

  // Quantitative Biology
  'q-bio.NC': 'Neurons and Cognition',
  'q-bio.QM': 'Quantitative Methods',
};

/** 获取分类全称，未知则返回缩写本身 */
export function getCategoryFullName(abbr: string): string {
  return ARXIV_CATEGORY_NAMES[abbr] || abbr;
}
