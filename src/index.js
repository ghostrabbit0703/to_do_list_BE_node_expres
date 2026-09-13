import express from 'express';
import cors from 'cors';
import userRouter from './routes/user.routes.js';
import categoryRouter from './routes/category.routes.js';
import tagRouter from './routes/tag.routes.js';
import taskRouter from './routes/task.routes.js';

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/ping', (req, res) => {
    res.json({
        success: true,
        message: 'pong'
    });
});

app.use('/api/auth', userRouter);
app.use('/api/categories', categoryRouter);
app.use('/api/tags', tagRouter);
app.use('/api/tasks', taskRouter);

app.use((req, res) => {
    res.status(404).json({
        message: `La ruta ${req.method} ${req.originalUrl} no existe`
    });
});

app.use((err, req, res, next) => {
    console.error(err);

    res.status(500).json({
        message: 'Algo salió mal en el servidor'
    });
});

export default app;