import { Link } from 'react-router-dom';

const tools = [
  { name: 'Generate Images with Structure', path: '/tools/image-generation', description: 'Craft and generate intricate images using a structured approach.' },
  { name: 'Travel Between Images', path: '/tools/video-travel', description: 'Create video sequences by defining paths between existing images.' },
  { name: 'Edit Travel (Image Edit)', path: '/tools/edit-travel', description: 'Edit an existing image using text prompts with the Fal Kontext model.' },
  // Add two more placeholder tools to fit the 4-column layout if desired
  // { name: 'Placeholder Tool 1', path: '#', description: 'Future tool placeholder.' },
  // { name: 'Placeholder Tool 2', path: '#', description: 'Another future tool placeholder.' },
];

export default function ToolSelectorPage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-4xl font-bold text-center mb-12">Select a Tool</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
        {tools.map((tool) => (
          <Link
            to={tool.path}
            key={tool.name}
            className="block p-6 bg-card text-card-foreground rounded-lg shadow-md hover:shadow-lg transition-shadow duration-200 ease-in-out transform hover:-translate-y-1"
          >
            <h2 className="text-2xl font-semibold mb-3">{tool.name}</h2>
            <p className="text-muted-foreground">{tool.description}</p>
          </Link>
        ))}
      </div>
    </div>
  );
} 