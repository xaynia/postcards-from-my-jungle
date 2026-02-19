# Postcards from my jungle

Live site: https://xaynia.github.io/postcards-from-my-jungle/

Postcards from my jungle is a lo-fi, GenAI imagined field guide to a fictional rainforest. Each postcard pairs a generated animal image with an invented animal language phrase, its English gloss, and a short synthesized call. The goal was to make the results feel like field notes: playful, slightly mysterious, and easy to browse.

## Strategies for training the image model
For image generation, I picked a real animal dataset and learned quickly that diffusion training is deceptively complex. Small changes can produce big differences in output, and many results can look like soft, painterly background textures (a lot of my early batches resembled Monet style scenery). The main learning was how many parameters matter at once: epochs, sampling frequency, and noise scheduling. In diffusion models, the scheduler and noise schedule define how noise is added during training and how sampling proceeds at inference, so tuning these choices directly affects clarity and artifacting. 

Google Colab was a major limiter because usage limits and runtime lifetimes fluctuate, and when a session ended I could lose progress and intermediate files. The biggest setback was trial and error under rate limiting. Once I hit limits or got disconnected, I often had to restart, so I learned to store checkpoints and outputs to Google Drive early and often.

Running on CPU was possible but much slower than GPU for my workflow, and it required code changes (device selection and related settings). When GPU time was available, iteration speed improved dramatically, which mattered because so much learning came from repeatedly training, sampling, and adjusting.

## How the beasts, sounds, and language were generated
For sound generation, I used a pretrained text to audio diffusion model to synthesize four distinct calls at different durations.

For language generation, I used a transformer model to produce 16 phrases with consistent phonetics and simple intents. The phrases are stored as structured JSON in `data/phrases.json` with `id`, `intent`, `animal_text`, `english_gloss`, and `mood`, and the site loads and cycles them at runtime.

## How quality could be improved
Image quality could improve with more diverse, higher resolution training data, longer training with careful monitoring, and more controlled sampling and noise schedule choices. Sound quality could improve by generating more candidates per prompt, increasing inference steps, and applying light postprocessing (EQ and noise reduction) to reduce diffusion artifacts.

## Dataset used for training
https://huggingface.co/datasets/ldgravy/Medieval-Bestiary