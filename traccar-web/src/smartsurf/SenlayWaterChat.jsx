import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogContent,
  IconButton,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import SendIcon from '@mui/icons-material/Send';
import { makeStyles } from 'tss-react/mui';
import { buildSafetyPromptContext } from './safetyContext';
import { useSmartSurfData } from './storage';

const useStyles = makeStyles()((theme) => ({
  paper: {
    width: 560,
    maxWidth: 'calc(100vw - 24px)',
    height: 680,
    maxHeight: 'calc(100vh - 32px)',
    borderRadius: 18,
    color: '#eaf3f7',
    background: 'linear-gradient(180deg, #10263d 0%, #071827 100%)',
    border: '1px solid rgba(53, 208, 162, .28)',
    boxShadow: '0 28px 80px rgba(0, 0, 0, .42)',
  },
  header: {
    padding: theme.spacing(2),
    borderBottom: '1px solid rgba(143, 211, 255, .16)',
  },
  messages: {
    flex: 1,
    minHeight: 0,
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1.2),
    paddingRight: theme.spacing(0.5),
  },
  message: {
    padding: theme.spacing(1.25, 1.5),
    borderRadius: 14,
    border: '1px solid rgba(143, 211, 255, .14)',
    whiteSpace: 'pre-wrap',
    lineHeight: 1.55,
    fontSize: 14,
  },
  ai: {
    alignSelf: 'flex-start',
    background: 'rgba(53, 208, 162, .1)',
    color: '#eaf3f7',
  },
  user: {
    alignSelf: 'flex-end',
    background: 'rgba(143, 211, 255, .13)',
    color: '#ffffff',
  },
  system: {
    alignSelf: 'stretch',
    background: 'rgba(7, 24, 39, .56)',
    color: '#b9cee1',
    fontSize: 13,
  },
  promptChip: {
    color: '#eaf3f7',
    borderColor: 'rgba(143, 211, 255, .24)',
  },
  input: {
    '& .MuiInputBase-root': {
      color: '#ffffff',
      background: 'rgba(7, 24, 39, .72)',
      borderRadius: 12,
    },
    '& .MuiOutlinedInput-notchedOutline': {
      borderColor: 'rgba(143, 211, 255, .22)',
    },
    '& .MuiInputLabel-root': {
      color: '#b9cee1',
    },
  },
}));

const promptChips = [
  'Is this beach safe for kitesurfing right now?',
  'What kite should I choose with my profile and gear?',
  'Which sensor should I trust most on this map?',
  'What are the no-go risks for this session?',
];

const SenlayWaterChat = ({ open, onClose, center, fusion, onSenlayPayload }) => {
  const { classes, cx } = useStyles();
  const { rider, safety, gear } = useSmartSurfData();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesRef = useRef(null);

  const intro = useMemo(() => {
    const sourceText = fusion?.nearestWindSensor
      ? `Nearest wind sensor: ${fusion.nearestWindSensor.name || fusion.nearestWindSensor.station_id} (${fusion.nearestWindSensor.distance_km} km).`
      : 'No nearby hardware wind sensor is selected yet; Senlay will still check model and available source data.';
    return `Senlay AI is tuned for kitesurfing and watersports at ${center.label}. ${sourceText}`;
  }, [center.label, fusion]);

  useEffect(() => {
    if (open && !messages.length) {
      setMessages([{ role: 'system', content: intro }]);
    }
  }, [open, intro, messages.length]);

  useEffect(() => {
    if (messagesRef.current) {
      messagesRef.current.scrollTop = messagesRef.current.scrollHeight;
    }
  }, [messages, loading]);

  const send = async (textOverride) => {
    const text = (textOverride || input).trim();
    if (!text || loading) return;
    setInput('');
    const nextMessages = [...messages, { role: 'user', content: text }];
    setMessages(nextMessages);
    setLoading(true);
    try {
      const composed = `${buildSafetyPromptContext({ rider, safety, gear, fusion })}\n\nUser question:\n${text}`;
      const response = await fetch('/senlay-api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: 'anthropic',
          messages: [{ role: 'user', content: composed }],
          lat: center.lat,
          lng: center.lon,
          units: rider.windUnits === 'knots' ? 'knots' : 'metric',
          field: 'kitesurfing',
        }),
      });
      const data = await response.json();
      if (!response.ok || data.error) throw new Error(data.error || `Senlay AI returned ${response.status}`);
      if (data.sensors) {
        onSenlayPayload?.({
          sensors: data.sensors,
          satellite: data.satellite,
          extended: data.extended,
          active_sources: data.active_sources,
        });
      }
      setMessages([...nextMessages, { role: 'assistant', content: data.answer || 'No answer returned.' }]);
    } catch (error) {
      setMessages([...nextMessages, { role: 'assistant', content: `Senlay AI error: ${error.message}` }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} PaperProps={{ className: classes.paper }}>
      <Box className={classes.header}>
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start" gap={2}>
          <Box>
            <Typography variant="overline" color="secondary">Senlay AI</Typography>
            <Typography variant="h5" sx={{ fontWeight: 900 }}>Watersports decision chat</Typography>
            <Typography sx={{ mt: 0.5, color: '#b9cee1' }}>
              Ask about the live map, sensor sources, wind, swell, tides, currents, gear, and session risk.
            </Typography>
          </Box>
          <IconButton color="inherit" onClick={onClose}>
            <CloseIcon />
          </IconButton>
        </Stack>
      </Box>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, p: 2, minHeight: 0 }}>
        <Stack direction="row" gap={1} sx={{ flexWrap: 'wrap' }}>
          {promptChips.map((prompt) => (
            <Chip
              key={prompt}
              label={prompt}
              variant="outlined"
              className={classes.promptChip}
              onClick={() => send(prompt)}
              disabled={loading}
            />
          ))}
        </Stack>
        <Box className={classes.messages} ref={messagesRef}>
          {messages.map((message, index) => (
            <Box
              key={`${message.role}-${index}`}
              className={cx(
                classes.message,
                message.role === 'user' && classes.user,
                message.role === 'assistant' && classes.ai,
                message.role === 'system' && classes.system,
              )}
            >
              {message.content}
            </Box>
          ))}
          {loading && (
            <Box className={cx(classes.message, classes.ai)}>
              <Stack direction="row" alignItems="center" gap={1}>
                <CircularProgress color="secondary" size={16} />
                <span>Reading Senlay physical-world context...</span>
              </Stack>
            </Box>
          )}
        </Box>
        <Stack direction="row" gap={1}>
          <TextField
            fullWidth
            size="small"
            label="Ask Senlay AI"
            value={input}
            className={classes.input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                send();
              }
            }}
          />
          <Button variant="contained" color="secondary" onClick={() => send()} disabled={loading || !input.trim()}>
            <SendIcon />
          </Button>
        </Stack>
      </DialogContent>
    </Dialog>
  );
};

export default SenlayWaterChat;
