import { BrowserRouter, Navigate, Route, Routes } from 'react-router'
import { ChessWorkspaceLayout } from './workspace/ChessWorkspaceLayout'
import {
  GamesWorkspace,
  OpeningsWorkspace,
  PlayWorkspace,
  StudyWorkspace,
  UnknownWorkspace,
} from './workspace/WorkspaceRoutes'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<ChessWorkspaceLayout />}>
          <Route index element={<Navigate replace to="/play" />} />
          <Route path="play" element={<PlayWorkspace />} />
          <Route path="openings" element={<OpeningsWorkspace />} />
          <Route path="games" element={<GamesWorkspace />} />
          <Route path="study" element={<StudyWorkspace />} />
          <Route path="*" element={<UnknownWorkspace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
